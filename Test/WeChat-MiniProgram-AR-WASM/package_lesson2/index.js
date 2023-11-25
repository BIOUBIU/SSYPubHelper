// 画布
const canvas1 = 'canvas1'
// 示例图片
const sampleImage1 = './assets/sampleImage1.png'
// 画布最大宽度
const maxCanvasWidth = 750
// wasm路径
global.wasm_url = '/package_lesson2/assets/opencv3.4.16.wasm.br'
// opencv_exec.js会从global.wasm_url获取wasm路径
let cv = require('./assets/opencv_exec.js');
class SortableContour {
    perimiterSize;
    areaSize;
    contour;
  
    constructor(fields) {
      Object.assign(this, fields);
    }
  }
Page({
	// 画布的dom对象
	canvasDom: null,
	data: {
		canvas1Width: 750,
		canvas1Height: 300,
		// 示例图片
		sampleImage1Url: sampleImage1,
	},
	onReady() {
		// 可见的画布
		this.initCanvas(canvas1)
	},
	// 获取画布
	initCanvas(canvasId) {
		var _that = this;
		wx.createSelectorQuery()
			.select('#' + canvasId)
			.fields({ node: true, size: true })
			.exec((res) => {
				const canvas2d = res[0].node;
				// 设置画布的宽度和高度
				canvas2d.width = res[0].width;
				canvas2d.height = res[0].height;
				_that.canvasDom = canvas2d
			});
	},
	// 获取图像数据和调整图像大小
	getImageData(image,offscreenCanvas) {
		var _that = this
		// const ctx = wx.createCanvasContext(canvasId);
		var canvasWidth = image.width;
		if (canvasWidth > maxCanvasWidth) {
			canvasWidth = maxCanvasWidth;
		}
		// canvas Height
		var canvasHeight = Math.floor(canvasWidth * (image.height / image.width));
		// 离屏画布的宽度和高度不能小于图像的
		offscreenCanvas.width = canvasWidth;
		offscreenCanvas.height = canvasHeight;
		// draw image on canvas
		var ctx = offscreenCanvas.getContext('2d')
		ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);
		// get image data from canvas
		var imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

		return imgData
	},
	// 创建图像对象
	async createImageElement(imgUrl) {
		var _that = this
		// 创建2d类型的离屏画布（需要微信基础库2.16.1以上）
		var offscreenCanvas = wx.createOffscreenCanvas({type: '2d'});
		const image = offscreenCanvas.createImage();
		await new Promise(function (resolve, reject) {
			image.onload = resolve
			image.onerror = reject
			image.src = imgUrl
		})
		const imageData = _that.getImageData(image,offscreenCanvas)
		return imageData
	},
	imgProcess1(imageData, canvasDom) {
		// 读取图像
		let src = cv.imread(imageData);
		let dst = new cv.Mat();
		// 灰度化
		cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
		// 显示图像
		cv.imshow(canvasDom, dst);
		// 回收对象
		src.delete();
		dst.delete()
	},
	imgProcess2(imageData, canvasDom) {
		let src = cv.imread(imageData);
		let dst = new cv.Mat();

		// 灰度化
		cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
		// 边缘检测
		cv.Canny(src, dst, 50, 100, 3, false);
        //Find all contours
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(dst, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        //Get area for all contours so we can find the biggest
        let sortableContours = [];
        for (let i = 0; i < contours.size(); i++) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt, false);
        let perim = cv.arcLength(cnt, false);

        sortableContours.push(new SortableContour({ areaSize: area, perimiterSize: perim, contour: cnt }));
        }

        //Sort 'em
        sortableContours = sortableContours.sort((item1, item2) => { return (item1.areaSize > item2.areaSize) ? -1 : (item1.areaSize < item2.areaSize) ? 1 : 0; }).slice(0, 5);

        //Ensure the top area contour has 4 corners (NOTE: This is not a perfect science and likely needs more attention)
        let approx = new cv.Mat();
        cv.approxPolyDP(sortableContours[0].contour, approx, .05 * sortableContours[0].perimiterSize, true);

if (approx.rows == 4) {
  console.log('Found a 4-corner approx');
  foundContour = approx;
}
else{
  console.log('No 4-corner large contour!');
  return;
}

       // foundContour = approx;
//Find the corners
//foundCountour has 2 channels (seemingly x/y), has a depth of 4, and a type of 12.  Seems to show it's a CV_32S "type", so the valid data is in data32S??
let corner1 = new cv.Point(foundContour.data32S[0], foundContour.data32S[1]);
let corner2 = new cv.Point(foundContour.data32S[2], foundContour.data32S[3]);
let corner3 = new cv.Point(foundContour.data32S[4], foundContour.data32S[5]);
let corner4 = new cv.Point(foundContour.data32S[6], foundContour.data32S[7]);

//Order the corners
let cornerArray = [{ corner: corner1 }, { corner: corner2 }, { corner: corner3 }, { corner: corner4 }];
//Sort by Y position (to get top-down)
cornerArray.sort((item1, item2) => { return (item1.corner.y < item2.corner.y) ? -1 : (item1.corner.y > item2.corner.y) ? 1 : 0; }).slice(0, 5);

//Determine left/right based on x position of top and bottom 2
let tl = cornerArray[0].corner.x < cornerArray[1].corner.x ? cornerArray[0] : cornerArray[1];
let tr = cornerArray[0].corner.x > cornerArray[1].corner.x ? cornerArray[0] : cornerArray[1];
let bl = cornerArray[2].corner.x < cornerArray[3].corner.x ? cornerArray[2] : cornerArray[3];
let br = cornerArray[2].corner.x > cornerArray[3].corner.x ? cornerArray[2] : cornerArray[3];

//Calculate the max width/height
let widthBottom = Math.hypot(br.corner.x - bl.corner.x, br.corner.y - bl.corner.y);
let widthTop = Math.hypot(tr.corner.x - tl.corner.x, tr.corner.y - tl.corner.y);
let theWidth = (widthBottom > widthTop) ? widthBottom : widthTop;
let heightRight = Math.hypot(tr.corner.x - br.corner.x, tr.corner.y - br.corner.y);
let heightLeft = Math.hypot(tl.corner.x - bl.corner.x, tr.corner.y - bl.corner.y);
let theHeight = (heightRight > heightLeft) ? heightRight : heightLeft;

//Transform!
let finalDestCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, theWidth - 1, 0, theWidth - 1, theHeight - 1, 0, theHeight - 1]); //
let srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.corner.x, tl.corner.y, tr.corner.x, tr.corner.y, br.corner.x, br.corner.y, bl.corner.x, bl.corner.y]);
let dsize = new cv.Size(theWidth, theHeight);
let M = cv.getPerspectiveTransform(srcCoords, finalDestCoords)
cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
        cv.imshow(canvasDom,dst);
        //cv.Canny(dst, dst, 50, 100, 3, false);
        //cv.imshow(canvasDom,dst);
		src.delete();
		dst.delete()
	},
	imgProcess3(imageData, canvasDom) {
		let src = cv.imread(imageData);
		let dst = new cv.Mat();

		// 灰度化
		cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);

		var orb = new cv.ORB();
		var keypoints = new cv.KeyPointVector();
		var descriptors = new cv.Mat();
		// 特征点
		orb.detect(src, keypoints)
		// 特征点的描述因子
		orb.compute(src, keypoints, descriptors)
		// 绘制特征点
		cv.drawKeypoints(src, keypoints, dst)

		cv.imshow(canvasDom, dst);
		src.delete();
		dst.delete()
	},
	async btnRun1() {
		var _that = this;
		// 将图像转换为ImageData
		const image1Data = await _that.createImageElement(sampleImage1)
		// 设置画布的显示大小
		_that.setData({
			canvas1Width: image1Data.width,
			canvas1Height: image1Data.height,
		})
		_that.imgProcess1(image1Data, _that.canvasDom)
	},
	async btnRun2() {
		// 同上
		var _that = this;
		const image1Data = await _that.createImageElement(sampleImage1)
		_that.setData({
			canvas1Width: image1Data.width,
			canvas1Height: image1Data.height,
		})
		_that.imgProcess2(image1Data, _that.canvasDom)
	},
	async btnRun3() {
		// 同上
		var _that = this;
		const image1Data = await _that.createImageElement(sampleImage1)
		_that.setData({
			canvas1Width: image1Data.width,
			canvas1Height: image1Data.height,
		})
		_that.imgProcess3(image1Data, _that.canvasDom)
	},
})
