import { simplify } from '../src/simplify';
import { largestTriangleThreeBuckets } from '../src/lttb';

test('simplify test', () => {
    let points: number[][] = [[0, 0], [1, 1], [2, 3], [3, 5], [4, 3], [5, 2], [6, 0]];
    let expected: number[][] = [[0, 0], [1, 1], [3, 5], [4, 3], [5, 2], [6, 0]];

    // console.log(simplify(points, 0.1, true));

    expect(simplify(points, 0.1, false)).toStrictEqual(expected);
});

test('simplify test with gaps', () => {
    let points: number[][] = [[0, 0], [1, 1], [2, 3], [3, 5], [4, 3], [5, 2], [6, NaN], [7, 1], [8, 3], [9, 5], [10, 3], [11, 2], [12, 0]];
    let expected: number[][] = [[0, 0], [1, 1], [3, 5], [4, 3], [5, 2], [6, NaN], [7, 1], [9, 5], [10, 3], [11, 2], [12, 0]];

    expect(points.length).toStrictEqual(13);

    // console.log(points);
    // console.log(simplify(points, 0.1, true));

    expect(simplify(points, 0.1, true)).toStrictEqual(expected);
});




// test('lttb simple test', () => {
//     let points: number[][] = [[0, 0], [1, 1], [2, 3], [3, 5], [4, 3], [5, 2], [6, 0]];
//     let expected: number[][] = [[0, 0], [1, 1], [3, 5], [4, 3], [5, 2], [6, 0]];

//     console.log(largestTriangleThreeBuckets(points, 10));

//     expect(largestTriangleThreeBuckets(points, 1)).toStrictEqual(expected);
// });

// test('simplify test with gaps', () => {
//     let points: number[][] = [[0, 0], [1, 1], [2, 3], [3, 5], [4, 3], [5, 2], [6, NaN], [7, 1], [8, 3], [9, 5], [10, 3], [11, 2], [12, 0]];
//     let expected: number[][] = [[0, 0], [1, 1], [3, 5], [4, 3], [5, 2], [7, 1], [9, 5], [10, 3], [11, 2], [12, 0]];

//     console.log(largestTriangleThreeBuckets(points, 5));

//     expect(largestTriangleThreeBuckets(points, 5)).toStrictEqual(expected);
// });