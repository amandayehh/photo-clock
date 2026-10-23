// src/distribute.ts
function distributeAndNormalize({
  topLeftCornerRadius,
  topRightCornerRadius,
  bottomRightCornerRadius,
  bottomLeftCornerRadius,
  width,
  height
}) {
  const roundingAndSmoothingBudgetMap = {
    topLeft: -1,
    topRight: -1,
    bottomLeft: -1,
    bottomRight: -1
  };
  const cornerRadiusMap = {
    topLeft: topLeftCornerRadius,
    topRight: topRightCornerRadius,
    bottomLeft: bottomLeftCornerRadius,
    bottomRight: bottomRightCornerRadius
  };
  Object.entries(cornerRadiusMap).sort(([, radius1], [, radius2]) => {
    return radius2 - radius1;
  }).forEach(([cornerName, radius]) => {
    const corner = cornerName;
    const adjacents = adjacentsByCorner[corner];
    const budget = Math.min(
      ...adjacents.map((adjacent) => {
        const adjacentCornerRadius = cornerRadiusMap[adjacent.corner];
        if (radius === 0 && adjacentCornerRadius === 0) {
          return 0;
        }
        const adjacentCornerBudget = roundingAndSmoothingBudgetMap[adjacent.corner];
        const sideLength = adjacent.side === "top" || adjacent.side === "bottom" ? width : height;
        if (adjacentCornerBudget >= 0) {
          return sideLength - roundingAndSmoothingBudgetMap[adjacent.corner];
        } else {
          return radius / (radius + adjacentCornerRadius) * sideLength;
        }
      })
    );
    roundingAndSmoothingBudgetMap[corner] = budget;
    cornerRadiusMap[corner] = Math.min(radius, budget);
  });
  return {
    topLeft: {
      radius: cornerRadiusMap.topLeft,
      roundingAndSmoothingBudget: roundingAndSmoothingBudgetMap.topLeft
    },
    topRight: {
      radius: cornerRadiusMap.topRight,
      roundingAndSmoothingBudget: roundingAndSmoothingBudgetMap.topRight
    },
    bottomLeft: {
      radius: cornerRadiusMap.bottomLeft,
      roundingAndSmoothingBudget: roundingAndSmoothingBudgetMap.bottomLeft
    },
    bottomRight: {
      radius: cornerRadiusMap.bottomRight,
      roundingAndSmoothingBudget: roundingAndSmoothingBudgetMap.bottomRight
    }
  };
}
var adjacentsByCorner = {
  topLeft: [
    {
      corner: "topRight",
      side: "top"
    },
    {
      corner: "bottomLeft",
      side: "left"
    }
  ],
  topRight: [
    {
      corner: "topLeft",
      side: "top"
    },
    {
      corner: "bottomRight",
      side: "right"
    }
  ],
  bottomLeft: [
    {
      corner: "bottomRight",
      side: "bottom"
    },
    {
      corner: "topLeft",
      side: "left"
    }
  ],
  bottomRight: [
    {
      corner: "bottomLeft",
      side: "bottom"
    },
    {
      corner: "topRight",
      side: "right"
    }
  ]
};

// src/draw.ts
function getPathParamsForCorner({
  cornerRadius,
  cornerSmoothing,
  preserveSmoothing,
  roundingAndSmoothingBudget
}) {
  let p = (1 + cornerSmoothing) * cornerRadius;
  if (!preserveSmoothing) {
    const maxCornerSmoothing = roundingAndSmoothingBudget / cornerRadius - 1;
    cornerSmoothing = Math.min(cornerSmoothing, maxCornerSmoothing);
    p = Math.min(p, roundingAndSmoothingBudget);
  }
  const arcMeasure = 90 * (1 - cornerSmoothing);
  const arcSectionLength = Math.sin(toRadians(arcMeasure / 2)) * cornerRadius * Math.sqrt(2);
  const angleAlpha = (90 - arcMeasure) / 2;
  const p3ToP4Distance = cornerRadius * Math.tan(toRadians(angleAlpha / 2));
  const angleBeta = 45 * cornerSmoothing;
  const c = p3ToP4Distance * Math.cos(toRadians(angleBeta));
  const d = c * Math.tan(toRadians(angleBeta));
  let b = (p - arcSectionLength - c - d) / 3;
  let a = 2 * b;
  if (preserveSmoothing && p > roundingAndSmoothingBudget) {
    const p1ToP3MaxDistance = roundingAndSmoothingBudget - d - arcSectionLength - c;
    const minA = p1ToP3MaxDistance / 6;
    const maxB = p1ToP3MaxDistance - minA;
    b = Math.min(b, maxB);
    a = p1ToP3MaxDistance - b;
    p = Math.min(p, roundingAndSmoothingBudget);
  }
  return {
    a,
    b,
    c,
    d,
    p,
    arcSectionLength,
    cornerRadius
  };
}
function getSVGPathFromPathParams({
  width,
  height,
  topLeftPathParams,
  topRightPathParams,
  bottomLeftPathParams,
  bottomRightPathParams
}) {
  return `
    M ${width - topRightPathParams.p} 0
    ${drawTopRightPath(topRightPathParams)}
    L ${width} ${height - bottomRightPathParams.p}
    ${drawBottomRightPath(bottomRightPathParams)}
    L ${bottomLeftPathParams.p} ${height}
    ${drawBottomLeftPath(bottomLeftPathParams)}
    L 0 ${topLeftPathParams.p}
    ${drawTopLeftPath(topLeftPathParams)}
    Z
  `.replace(/[\t\s\n]+/g, " ").trim();
}
function drawTopRightPath({
  cornerRadius,
  a,
  b,
  c,
  d,
  p,
  arcSectionLength
}) {
  if (cornerRadius) {
    return rounded`
    c ${a} 0 ${a + b} 0 ${a + b + c} ${d}
    a ${cornerRadius} ${cornerRadius} 0 0 1 ${arcSectionLength} ${arcSectionLength}
    c ${d} ${c}
        ${d} ${b + c}
        ${d} ${a + b + c}`;
  } else {
    return rounded`l ${p} 0`;
  }
}
function drawBottomRightPath({
  cornerRadius,
  a,
  b,
  c,
  d,
  p,
  arcSectionLength
}) {
  if (cornerRadius) {
    return rounded`
    c 0 ${a}
      0 ${a + b}
      ${-d} ${a + b + c}
    a ${cornerRadius} ${cornerRadius} 0 0 1 -${arcSectionLength} ${arcSectionLength}
    c ${-c} ${d}
      ${-(b + c)} ${d}
      ${-(a + b + c)} ${d}`;
  } else {
    return rounded`l 0 ${p}`;
  }
}
function drawBottomLeftPath({
  cornerRadius,
  a,
  b,
  c,
  d,
  p,
  arcSectionLength
}) {
  if (cornerRadius) {
    return rounded`
    c ${-a} 0
      ${-(a + b)} 0
      ${-(a + b + c)} ${-d}
    a ${cornerRadius} ${cornerRadius} 0 0 1 -${arcSectionLength} -${arcSectionLength}
    c ${-d} ${-c}
      ${-d} ${-(b + c)}
      ${-d} ${-(a + b + c)}`;
  } else {
    return rounded`l ${-p} 0`;
  }
}
function drawTopLeftPath({
  cornerRadius,
  a,
  b,
  c,
  d,
  p,
  arcSectionLength
}) {
  if (cornerRadius) {
    return rounded`
    c 0 ${-a}
      0 ${-(a + b)}
      ${d} ${-(a + b + c)}
    a ${cornerRadius} ${cornerRadius} 0 0 1 ${arcSectionLength} -${arcSectionLength}
    c ${c} ${-d}
      ${b + c} ${-d}
      ${a + b + c} ${-d}`;
  } else {
    return rounded`l 0 ${-p}`;
  }
}
function toRadians(degrees) {
  return degrees * Math.PI / 180;
}
function rounded(strings, ...values) {
  return strings.reduce((acc, str, i) => {
    const value = values[i];
    if (typeof value === "number") {
      return acc + str + value.toFixed(4);
    } else {
      return acc + str + (value ?? "");
    }
  }, "");
}

// src/index.ts
function getSvgPath({
  cornerRadius = 0,
  topLeftCornerRadius,
  topRightCornerRadius,
  bottomRightCornerRadius,
  bottomLeftCornerRadius,
  cornerSmoothing,
  width,
  height,
  preserveSmoothing = false
}) {
  topLeftCornerRadius = topLeftCornerRadius ?? cornerRadius;
  topRightCornerRadius = topRightCornerRadius ?? cornerRadius;
  bottomLeftCornerRadius = bottomLeftCornerRadius ?? cornerRadius;
  bottomRightCornerRadius = bottomRightCornerRadius ?? cornerRadius;
  if (topLeftCornerRadius === topRightCornerRadius && topRightCornerRadius === bottomRightCornerRadius && bottomRightCornerRadius === bottomLeftCornerRadius && bottomLeftCornerRadius === topLeftCornerRadius) {
    const roundingAndSmoothingBudget = Math.min(width, height) / 2;
    const cornerRadius2 = Math.min(
      topLeftCornerRadius,
      roundingAndSmoothingBudget
    );
    const pathParams = getPathParamsForCorner({
      cornerRadius: cornerRadius2,
      cornerSmoothing,
      preserveSmoothing,
      roundingAndSmoothingBudget
    });
    return getSVGPathFromPathParams({
      width,
      height,
      topLeftPathParams: pathParams,
      topRightPathParams: pathParams,
      bottomLeftPathParams: pathParams,
      bottomRightPathParams: pathParams
    });
  }
  const { topLeft, topRight, bottomLeft, bottomRight } = distributeAndNormalize(
    {
      topLeftCornerRadius,
      topRightCornerRadius,
      bottomRightCornerRadius,
      bottomLeftCornerRadius,
      width,
      height
    }
  );
  return getSVGPathFromPathParams({
    width,
    height,
    topLeftPathParams: getPathParamsForCorner({
      cornerSmoothing,
      preserveSmoothing,
      cornerRadius: topLeft.radius,
      roundingAndSmoothingBudget: topLeft.roundingAndSmoothingBudget
    }),
    topRightPathParams: getPathParamsForCorner({
      cornerSmoothing,
      preserveSmoothing,
      cornerRadius: topRight.radius,
      roundingAndSmoothingBudget: topRight.roundingAndSmoothingBudget
    }),
    bottomRightPathParams: getPathParamsForCorner({
      cornerSmoothing,
      preserveSmoothing,
      cornerRadius: bottomRight.radius,
      roundingAndSmoothingBudget: bottomRight.roundingAndSmoothingBudget
    }),
    bottomLeftPathParams: getPathParamsForCorner({
      cornerSmoothing,
      preserveSmoothing,
      cornerRadius: bottomLeft.radius,
      roundingAndSmoothingBudget: bottomLeft.roundingAndSmoothingBudget
    })
  });
}
export {
  getSvgPath
};
