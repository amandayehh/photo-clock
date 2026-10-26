// Aim for about 180px per column including gutters, with 3–8 columns.
export function gridColumns(width){return Math.max(3,Math.min(8,Math.round(width/180)));}
export function gridLayout(cellWidth,stageHeight=Infinity){
  const pad=Math.max(3,Math.min(10,cellWidth*.045));
  const layout={
    pad,gap:pad*.75,radius:pad*.8,
    titleSize:Math.max(9,Math.min(18,cellWidth*.085)),
    stampSize:Math.max(7,Math.min(11,cellWidth*.045))
  };
  const imageWidth=Math.max(0,cellWidth-2*pad);
  const imageHeight=Math.max(0,stageHeight-2*pad-2*layout.gap-1.15*(layout.titleSize+layout.stampSize));
  // Ordinary proportions share an area; outliers do not resize the other cells.
  return {...layout,imageWidth,imageHeight,area:Math.min(imageWidth**2,imageHeight**2)/2};
}
export function gridImageDimensions(layout,ratio){
  const area=ratio<.5||ratio>2?Math.min(layout.area,layout.imageWidth**2/ratio,layout.imageHeight**2*ratio):layout.area;
  return {width:Math.sqrt(area*ratio),height:Math.sqrt(area/ratio)};
}
export function cardTransform(pose,grid){
  return grid?`translate(${pose.x}px, ${pose.y}px) rotate(${pose.angle}deg)`:
    `translate(-50%, -50%) translate(${pose.x}px, ${pose.y}px) rotate(${pose.angle}deg)`;
}
