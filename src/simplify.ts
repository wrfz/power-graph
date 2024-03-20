import { TimeRange } from './GraphData'

type Point = number[];

function getSquareDistance(p1: Point, p2: Point) {

    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];

    return dx * dx + dy * dy;
}

// square distance from a point to a segment
function getSquareSegmentDistance(p: Point, p1: Point, p2: Point) {

    let x = p1[0];
    let y = p1[1];
    let dx = p2[0] - x;
    let dy = p2[1] - y;

    if (dx !== 0 || dy !== 0) {
        const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);

        if (t > 1) {
            x = p2[0];
            y = p2[1];
        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }

    dx = p[0] - x;
    dy = p[1] - y;

    return dx * dx + dy * dy;
}
// rest of the code doesn't care about point format

// basic distance-based simplification
function simplifyRadialDist(points: Point[], squareTolerance: number) {

    let prevPoint = points[0];
    const newPoints = [prevPoint];
    let point: Point | null = null;

    for (let i = 1, len = points.length; i < len; i++) {
        point = points[i];

        if (getSquareDistance(point, prevPoint) > squareTolerance) {
            newPoints.push(point);
            prevPoint = point;
        }
    }

    if (point != null && prevPoint !== point) {
        newPoints.push(point);
    }
    return newPoints;
}

function simplifyDPStep(points: Point[], first: number, last: number, squareTolerance: number, simplified: Point[]) {
    let maxSquareDistance = squareTolerance;
    let index: number = 0;

    for (let i = first + 1; i < last; i++) {
        const sqDist = getSquareSegmentDistance(points[i], points[first], points[last]);

        if (sqDist > maxSquareDistance) {
            index = i;
            maxSquareDistance = sqDist;
        }
    }

    if (maxSquareDistance > squareTolerance) {
        if (index - first > 1) {
            simplifyDPStep(points, first, index, squareTolerance, simplified);
        }
        simplified.push(points[index]);
        if (last - index > 1) {
            simplifyDPStep(points, index, last, squareTolerance, simplified);
        }
    }
}

// simplification using Ramer-Douglas-Peucker algorithm
function simplifyDouglasPeucker(points: Point[], squareTolerance: number, minTime: number, maxTime: number) {
    const simplified: Point[] = [];

    let first: number | null = null;
    let lastIndex: number = -1;
    for (let index = 0; index < points.length; ++index) {
        const point: number[] = points[index];
        if (point[0] >= minTime && point[0] <= maxTime) {
            const value: number = point[1];
            if (!isNaN(value) && value != null) {
                if (first == null) {
                    first = index;
                }
                lastIndex = index;
            } else if (first != null) {
                const last = index - 1;
                simplified.push(points[first]);
                simplifyDPStep(points, first, last, squareTolerance, simplified);
                simplified.push(points[last]);
                simplified.push(point); // add point with NaN value
                first = null;
            }
        } else if (point[0] > maxTime) {
            break;
        }
    }

    if (first != null) {
        simplified.push(points[first]);
        simplifyDPStep(points, first, lastIndex, squareTolerance, simplified);
        simplified.push(points[lastIndex]);
    }

    return simplified;
}

// both algorithms combined for awesome performance
export function simplify(points: Point[], tolerance: number, minTime: number, maxTime: number, highestQuality: boolean) {

    if (points.length <= 2) {
        return points;
    }

    const squareTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

    points = highestQuality ? points : simplifyRadialDist(points, squareTolerance);
    points = simplifyDouglasPeucker(points, squareTolerance, minTime, maxTime);

    return points;
}