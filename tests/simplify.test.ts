import { simplify } from '../src/simplify';
import { largestTriangleThreeBuckets } from '../src/lttb';
import { mergeDeep, isNumber, toNumber } from '../src/utils';
import { GraphData, Pair, getTimeRange } from '../src/GraphData';
import { DateTime, Settings } from "luxon";
// import * as dayjs from 'dayjs'
// import * as isLeapYear from 'dayjs/plugin/isLeapYear' // import plugin
// import 'dayjs/locale/zh-cn' // import locale
// import { DateTime } from "luxon";

import { formatDistance, subDays } from "date-fns";

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

test('subHours', () => {
    // 1 minute range
    expect(getTimeRange(DateTime.local(2024, 3, 15, 10, 24, 17), DateTime.local(2024, 3, 15, 10, 24, 38))).
        toStrictEqual(new Pair<DateTime, DateTime>(
            DateTime.local(2024, 3, 15, 10, 24, 0),
            DateTime.local(2024, 3, 15, 10, 24, 59)));

    // 1 hour range
    expect(getTimeRange(DateTime.local(2024, 3, 15, 10, 24, 17), DateTime.local(2024, 3, 15, 10, 55, 25))).
        toStrictEqual(new Pair<DateTime, DateTime>(
            DateTime.local(2024, 3, 15, 10, 0, 0),
            DateTime.local(2024, 3, 15, 10, 59, 59)));

    // 1 day range
    expect(getTimeRange(DateTime.local(2024, 3, 15, 10, 24, 17), DateTime.local(2024, 3, 15, 13, 55, 25))).
        toStrictEqual(new Pair<DateTime, DateTime>(
            DateTime.local(2024, 3, 15, 0, 0, 0),
            DateTime.local(2024, 3, 15, 23, 59, 59)));

    // 1 month range
    expect(getTimeRange(DateTime.local(2024, 2, 15, 10, 24, 17), DateTime.local(2024, 2, 17, 13, 55, 25))).
        toStrictEqual(new Pair<DateTime, DateTime>(
            DateTime.local(2024, 2, 1, 0, 0, 0),
            DateTime.local(2024, 2, 29, 23, 59, 59)));
});



