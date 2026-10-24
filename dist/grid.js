export function gridColumns(width){return width>=1024?8:width>=768?6:4;}
export function gridCardLayout(cellWidth,ratio){
  const pad=Math.max(3,Math.min(10,cellWidth*.045));
  const width=Math.max(1,cellWidth-2*pad);
  return {
    width,height:width/ratio,pad,gap:pad*.75,radius:pad*.8,
    titleSize:Math.max(9,Math.min(18,cellWidth*.085)),
    stampSize:Math.max(7,Math.min(11,cellWidth*.045))
  };
}
export function cardTransform(pose,grid){
  return grid?`translate(${pose.x}px, ${pose.y}px) rotate(${pose.angle}deg)`:
    `translate(-50%, -50%) translate(${pose.x}px, ${pose.y}px) rotate(${pose.angle}deg)`;
}
