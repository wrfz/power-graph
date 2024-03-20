import { simplify } from '../src/simplify';
import { largestTriangleThreeBuckets } from '../src/lttb';
import { mergeDeep, isNumber, toNumber } from '../src/utils';
import { GraphData, Pair, TimeRange, getCurrentDataTimeRange, getTimeRangeOld } from '../src/GraphData';
import { DateTime, Settings, Duration } from "luxon";
// import * as dayjs from 'dayjs'
// import * as isLeapYear from 'dayjs/plugin/isLeapYear' // import plugin
// import 'dayjs/locale/zh-cn' // import locale
// import { DateTime } from "luxon";

import { formatDistance, subDays } from "date-fns";

test('simplify test', () => {
    let points: number[][] = [[0, 0], [1, 1], [2, 3], [3, 5], [4, 3], [5, 2], [6, 0]];
    let expected: number[][] = [[0, 0], [1, 1], [3, 5], [4, 3], [5, 2], [6, 0]];

    // console.log(simplify(points, 0.1, true));

    expect(simplify(points, 0.1, 0, 6, false)).toStrictEqual(expected);
});

test('simplify test with gaps', () => {
    let points: number[][] = [[0, 0], [1, 1], [2, 3], [3, 5], [4, 3], [5, 2], [6, NaN], [7, 1], [8, 3], [9, 5], [10, 3], [11, 2], [12, 0]];
    let expected: number[][] = [[0, 0], [1, 1], [3, 5], [4, 3], [5, 2], [6, NaN], [7, 1], [9, 5], [10, 3], [11, 2], [12, 0]];

    expect(points.length).toStrictEqual(13);

    // console.log(points);
    // console.log(simplify(points, 0.1, true));

    expect(simplify(points, 0.1, 0, 12, true)).toStrictEqual(expected);
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

test('getTimeRangeOld', () => {
    // 1 minute range
    expect(getTimeRangeOld(DateTime.local(2024, 3, 15, 10, 24, 17, 11), DateTime.local(2024, 3, 15, 10, 24, 38, 77))).
        toStrictEqual(new TimeRange(
            DateTime.local(2024, 3, 15, 10, 24, 0, 0),
            DateTime.local(2024, 3, 15, 10, 24, 59, 999)));

    // 1 hour range
    expect(getTimeRangeOld(DateTime.local(2024, 3, 15, 10, 24, 17, 13), DateTime.local(2024, 3, 15, 10, 55, 25, 888))).
        toStrictEqual(new TimeRange(
            DateTime.local(2024, 3, 15, 10, 0, 0, 0),
            DateTime.local(2024, 3, 15, 10, 59, 59, 999)));

    // 1 day range
    expect(getTimeRangeOld(DateTime.local(2024, 3, 15, 10, 24, 17, 56), DateTime.local(2024, 3, 15, 13, 55, 25, 99))).
        toStrictEqual(new TimeRange(
            DateTime.local(2024, 3, 15, 0, 0, 0, 0),
            DateTime.local(2024, 3, 15, 23, 59, 59, 999)));

    // 1 month range
    expect(getTimeRangeOld(DateTime.local(2024, 2, 15, 10, 24, 17, 356), DateTime.local(2024, 2, 17, 13, 55, 25, 123))).
        toStrictEqual(new TimeRange(
            DateTime.local(2024, 2, 1, 0, 0, 0, 0),
            DateTime.local(2024, 2, 29, 23, 59, 59, 999)));
});

test('getTimeRange', () => {
    // Test case:
    //
    //       16.3   17.3   17.3   18.3
    //       12:00  00:00  12:00  00:00
    //   ______|______|______|______|______


    const dataRange: TimeRange = new TimeRange(
        DateTime.local(2024, 3, 16, 12, 0, 0, 0), DateTime.local(2024, 3, 18, 0, 0, 0, 0)
    );

    expect(getCurrentDataTimeRange(dataRange, new TimeRange(DateTime.local(2024, 3, 16, 12, 3, 0, 0), DateTime.local(2024, 3, 17, 20, 0, 0, 0)))).
        toStrictEqual(dataRange);
    expect(getCurrentDataTimeRange(dataRange, new TimeRange(DateTime.local(2024, 3, 16, 12, 3, 0, 0), DateTime.local(2024, 3, 17, 10, 0, 0, 0)))).
        toStrictEqual(dataRange);
    expect(getCurrentDataTimeRange(dataRange, new TimeRange(DateTime.local(2024, 3, 17, 8, 0, 0, 0), DateTime.local(2024, 3, 17, 15, 0, 0, 0)))).
        toStrictEqual(dataRange);

    // zoom in left
    expect(getCurrentDataTimeRange(dataRange, new TimeRange(DateTime.local(2024, 3, 16, 12, 3, 0, 0), DateTime.local(2024, 3, 16, 23, 0, 0, 0)))).
        toStrictEqual(new TimeRange(
            DateTime.local(2024, 3, 16, 12, 0, 0, 0), DateTime.local(2024, 3, 17, 0, 0, 0, 0)
        ));

    // zoom in center
    expect(getCurrentDataTimeRange(dataRange, new TimeRange(DateTime.local(2024, 3, 17, 0, 3, 0, 0), DateTime.local(2024, 3, 17, 11, 0, 0, 0)))).
        toStrictEqual(new TimeRange(
            DateTime.local(2024, 3, 17, 0, 0, 0, 0), DateTime.local(2024, 3, 17, 12, 0, 0, 0)
        ));

    // zoom in right
    expect(getCurrentDataTimeRange(dataRange, new TimeRange(DateTime.local(2024, 3, 17, 12, 3, 0, 0), DateTime.local(2024, 3, 17, 23, 0, 0, 0)))).
        toStrictEqual(new TimeRange(
            DateTime.local(2024, 3, 17, 12, 0, 0, 0), DateTime.local(2024, 3, 18, 0, 0, 0, 0)
        ));

    // zoom in deep
    expect(getCurrentDataTimeRange(dataRange, new TimeRange(DateTime.local(2024, 3, 17, 5, 30, 0, 0), DateTime.local(2024, 3, 17, 6, 30, 0, 0)))).
        toStrictEqual(new TimeRange(
            DateTime.local(2024, 3, 17, 5, 20, 0, 0), DateTime.local(2024, 3, 17, 6, 40, 0, 0)
        ));

    // zoom out left
    expect(getCurrentDataTimeRange(dataRange, new TimeRange(DateTime.local(2024, 3, 16, 11, 0, 0, 0), DateTime.local(2024, 3, 17, 23, 30, 0, 0)))).
        toStrictEqual(new TimeRange(
            DateTime.local(2024, 3, 13, 12, 0, 0, 0), DateTime.local(2024, 3, 18, 0, 0, 0, 0)
        ));

    // zoom out left
    expect(getCurrentDataTimeRange(dataRange, new TimeRange(DateTime.local(2024, 3, 16, 13, 0, 0, 0), DateTime.local(2024, 3, 18, 1, 0, 0, 0)))).
        toStrictEqual(new TimeRange(
            DateTime.local(2024, 3, 16, 12, 0, 0, 0), DateTime.local(2024, 3, 21, 0, 0, 0, 0)
        ));

});

test('getData', () => {
    const graphData: GraphData = new GraphData();

    let time: DateTime = DateTime.local(2024, 1, 1);
    const timeStep = Duration.fromObject({ minute: 10 });
    const arr: number[][] = [];
    let value: number = 100;
    for (let index = 0; index < 30; ++index) {
        value += 10 + index * index;
        arr.push([time.toMillis(), value % 100]);
        time = time.plus(timeStep);
    }
    graphData.add(0, arr);

    const maxTimeRange = new TimeRange(
        DateTime.local(2024, 1, 1, 0),
        DateTime.local(2024, 1, 1, 0, 9));

    const newTimeRange: TimeRange = getCurrentDataTimeRange(maxTimeRange, new TimeRange(
        DateTime.local(2024, 1, 1, 3),
        DateTime.local(2024, 1, 1, 4)));

    expect(newTimeRange).toStrictEqual(new TimeRange(
        DateTime.local(2024, 1, 1, 2, 42),
        DateTime.local(2024, 1, 1, 4, 3)))

    const result: string = toStr(graphData.getDataByTimeRange(0, newTimeRange, maxTimeRange));
    expect(result).toStrictEqual(
        "2024-01-01T00:00:00.000+00:00 - NaN\n" +
        "2024-01-01T02:50:00.000+00:00 - 65\n" +
        "2024-01-01T03:00:00.000+00:00 - 99\n" +
        "2024-01-01T03:10:00.000+00:00 - 70\n" +
        "2024-01-01T03:20:00.000+00:00 - 80\n" +
        "2024-01-01T03:30:00.000+00:00 - 31\n" +
        "2024-01-01T03:40:00.000+00:00 - 25\n" +
        "2024-01-01T03:50:00.000+00:00 - 64\n" +
        "2024-01-01T04:00:00.000+00:00 - 50\n"
    )
});

test('experiments', () => {
    const t1: DateTime = DateTime.local(2024, 1, 1, 1, 0, 0, 0);
    const t2: DateTime = DateTime.local(2024, 1, 1, 1, 0, 0, 1);
    expect(t1 < t2).toBe(true);
    expect(t2 > t1).toBe(true);
    expect(t2 != t1).toBe(true);

    expect(Math.max(+t1, +t2, +t1)).toBe(+t2);
});

test('Pair.equals', () => {
    const t1: DateTime = DateTime.local(2020, 1, 2, 3, 4, 5, 6);
    const t2: DateTime = DateTime.local(2021, 2, 3, 4, 5, 6, 7);
    expect(new Pair<number, number>(1, 2).equals(new Pair<number, number>(1, 2))).toBe(true);
    expect(new TimeRange(t1, t2).equals(new TimeRange(
        DateTime.local(2020, 1, 2, 3, 4, 5, 6),
        DateTime.local(2021, 2, 3, 4, 5, 6, 7)
    ))).toBe(true);
});

function toStr(data: number[][]): string {
    let result: string = "";
    for (let point of data) {
        const dateTime: DateTime = DateTime.fromMillis(point[0]);
        result += dateTime.toISO();
        result += " - ";
        result += point[1];
        result += "\n";
    }
    return result;
}