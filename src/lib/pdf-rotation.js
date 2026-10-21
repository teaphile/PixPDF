import {
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState
} from "@cantoo/pdf-lib";

export function pageDisplayTransform(page) {
  const { width: rawWidth, height: rawHeight } = page.getSize();
  const rotation = (((Number(page.getRotation()?.angle) || 0) % 360) + 360) % 360;
  if (rotation === 90) {
    return {
      rotation,
      rawWidth,
      rawHeight,
      width: rawHeight,
      height: rawWidth,
      matrix: [0, 1, -1, 0, rawWidth, 0]
    };
  }
  if (rotation === 180) {
    return {
      rotation,
      rawWidth,
      rawHeight,
      width: rawWidth,
      height: rawHeight,
      matrix: [-1, 0, 0, -1, rawWidth, rawHeight]
    };
  }
  if (rotation === 270) {
    return {
      rotation,
      rawWidth,
      rawHeight,
      width: rawHeight,
      height: rawWidth,
      matrix: [0, -1, 1, 0, 0, rawHeight]
    };
  }
  return {
    rotation: 0,
    rawWidth,
    rawHeight,
    width: rawWidth,
    height: rawHeight,
    matrix: [1, 0, 0, 1, 0, 0]
  };
}

export function withDisplaySpace(page, callback) {
  const geometry = pageDisplayTransform(page);
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...geometry.matrix));
  try {
    return callback(geometry);
  } finally {
    page.pushOperators(popGraphicsState());
  }
}
