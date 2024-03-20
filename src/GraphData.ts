import { dataTool } from "echarts";
import { GraphConfig } from "./GraphConfig";
import { simplify } from './simplify';
import { DateTime, Duration } from "luxon";
import { DateTimeUtils } from "./utils";

export class Pair<T1, T2> {
    first: T1;
    second: T2;

    constructor(first: T1, second: T2);
    constructor(obj: Pair<T1, T2>);
    constructor(...args: any) {
        if (args.length === 2) {
            this.first = args[0];
            this.second = args[1];
        } else if (args.length === 1) { // copy constructor
            const pair: Pair<T1, T2> = args[0];
            if (pair != null) {
                this.first = pair.first;
                this.second = pair.second;
            }
        }
    }

    equals(pair: Pair<T1, T2>): boolean {
        return this.first === pair.first && this.second == pair.second;
    }

    toString(): string {
        return "[" + this.first + ", " + this.second + "]";
    }
};

export class TimeRange extends Pair<DateTime, DateTime> {
    get from(): DateTime {
        return this.first;
    }
    get to(): DateTime {
        return this.second;
    }

    set from(value: DateTime) {
        this.first = value;
    }
    set to(value: DateTime) {
        this.second = value;
    }

    equals(other: TimeRange): boolean {
        if (other instanceof TimeRange) {
            return (this.first == null) == (other.first == null) &&
                (this.second == null) == (other.second == null) &&
                this.first.equals(other.first) && this.second.equals(other.second);
        } else {
            return false;
        }
    }

    toString(): string {
        return `[${this.from.toFormat('dd.LL.yyyy hh:mm:ss SSS')} - ${this.to.toFormat('dd.LL.yyyy hh:mm:ss SSS')}]`;
    }
};

class DataBlock {
    private _data: number[][];

    constructor(data?: number[][]) {
        this._data = data != null ? data : [];
    }

    getTimeRange(): TimeRange {
        return new TimeRange(
            DateTime.fromMillis(this._data[0][0]),
            DateTime.fromMillis(this._data[this._data.length - 1][0])
        );
    }

    hasData(): boolean {
        return this._data.length > 0;
    }

    getData(): number[][] {
        return this._data;
    }

    setData(data: number[][]): void {
        this._data = data;
    }

    add(data: number[][]): void {
        const isUnshift: boolean = data.length > 0 && this._data.length > 0 && data[0][0] < this._data[0][0];

        if (isUnshift) {
            this._data.unshift(...data);
            // console.log("unshift: " + data);
        } else {
            this._data.push(...data);
            // console.log("push: " + data);
        }
    }

    simplify(quality: number): number[][] {
        return simplify(this._data, quality, null, null, true);
    }
}

class EntityData {
    private _graphData: GraphData;
    private _dataBlock: DataBlock[];
    private _map: Map<TimeRange, number[][]> = new Map<TimeRange, number[][]>;

    constructor(graphData: GraphData) {
        this._graphData = graphData;
        this._dataBlock = [new DataBlock()];
    }

    hasData(): boolean {
        const dataBlock: DataBlock = this._dataBlock[0];
        return dataBlock.hasData();
    }

    getData(entityQualityIndex: number): number[][] {
        const dataBlock: DataBlock = this._dataBlock[entityQualityIndex];
        return dataBlock.getData();
    }

    getDataByTimeRange(timeRange: TimeRange, entireTimeRange: TimeRange): number[][] {
        let data: number[][] = this._map.get(timeRange);
        if (data == null) {
            const dataBlock: DataBlock = this._dataBlock[0];
            const orgData: number[][] = dataBlock.getData();

            data = simplify(orgData, 0.05, timeRange.first.toMillis(), timeRange.second.toMillis(), true);
            if (data[0][0] > entireTimeRange.from.toMillis()) {
                data.unshift([entireTimeRange.from.toMillis(), NaN]);
            }
            if (data[data.length - 1][0] < entireTimeRange.to.toMillis()) {
                data.push([entireTimeRange.to.toMillis(), NaN]);
            }
            this._map.set(timeRange, data);
        }
        return data;
        // const dataBlock: DataBlock = this._dataBlock[entityQualityIndex];
        // return dataBlock.getData();
    }

    add(data: number[][], timeRange: TimeRange): void {
        const dataBlock: DataBlock = this._dataBlock[0];
        dataBlock.add(data);

        // let index = 0;
        // for (const quality of this._graphData.getQualities()) {
        //     ++index;
        //     while (this._dataBlock.length <= index) {
        //         this._dataBlock.push(new DataBlock());
        //     }
        //     const sampledData: number[][] = dataBlock.simplify(quality);
        //     this._dataBlock[index].setData(sampledData);
        // }
    }

    getTimeRange(): TimeRange {
        const dataBlock: DataBlock = this._dataBlock[0];
        return dataBlock.getTimeRange();
    }
}

export class GraphData {
    private _entityData: EntityData[];
    private _qualities: number[];
    private _timeRange: TimeRange = new TimeRange(DateTime.local(3000), DateTime.local(1980));

    constructor() {
        this._entityData = [];
    }

    setQualities(qualities: number[]): void {
        this._qualities = qualities;
    }

    getQualities(): number[] {
        return this._qualities;
    }

    hasData(): boolean {
        const entityData: EntityData = this._entityData[0];
        return entityData != null ? entityData.hasData() : false;
    }

    getData(entityIndex: number, entityQualityIndex: number): number[][] {
        const entityData: EntityData = this._entityData[entityIndex];
        return entityData.getData(entityQualityIndex);
    }

    getDataByTimeRange(entityIndex: number, timeRange: TimeRange, entireTimeRange: TimeRange): number[][] {
        const entityData: EntityData = this._entityData[entityIndex];
        return entityData.getDataByTimeRange(timeRange, entireTimeRange);
    }

    add(entityIndex: number, data: number[][]): void {
        if (data.length > 0) {
            this._timeRange.from = DateTimeUtils.min(this._timeRange.from, DateTime.fromMillis(data[0][0]));
            this._timeRange.to = DateTimeUtils.max(this._timeRange.to, DateTime.fromMillis(data[data.length - 1][0]));
        }

        while ((this._entityData.length - 1) < entityIndex) {
            this._entityData.push(new EntityData(this));
        }

        const entityData: EntityData = this._entityData[entityIndex];
        entityData.add(data, this._timeRange);
    }

    /**
   * Returns the time range of the entire loaded data.
   *
   * @returns Time range {@link TimeRange}
   */
    getMaxTimeRange(): TimeRange {
        return this._timeRange;
    }
}

/**
 * Returns the time range of the sampled data
 * @param dataRange Time range of the entire loaded data
 * @param viewport
 * @returns
 */
export function getCurrentDataTimeRange(dataRange: TimeRange, viewport: TimeRange): TimeRange {
    if (viewport.to.toMillis() <= viewport.from.toMillis()) {
        throw new Error(`Invalid dataRange: [${viewport.from}, ${viewport.to}]`);
    }

    const diff: Duration = Duration.fromMillis(dataRange.to.diff(dataRange.from).toMillis() / 3.0);

    const p0: DateTime = dataRange.from;
    const p3: DateTime = dataRange.to;

    if (viewport.from >= p0 && viewport.to <= dataRange.to) {
        const p1: DateTime = p0.plus(diff);
        const p2: DateTime = p1.plus(diff);
        if (viewport.to <= p1) {
            return getCurrentDataTimeRange(new TimeRange(p0, p1), viewport);
        } else if (viewport.from >= p1 && viewport.to <= p2) {
            return getCurrentDataTimeRange(new TimeRange(p1, p2), viewport);
        } else if (viewport.from >= p2 && viewport.to <= p3) {
            return getCurrentDataTimeRange(new TimeRange(p2, p3), viewport);
        } else {
            return dataRange;
        }
    } else if (viewport.from < p0 && viewport.to <= p3) {
        const diff: Duration = p3.diff(p0);
        return getCurrentDataTimeRange(new TimeRange(p0.minus(diff).minus(diff), p3), viewport);
    } else if (viewport.to > p3 && viewport.from >= p0) {
        const diff: Duration = p3.diff(p0);
        return getCurrentDataTimeRange(new TimeRange(p0, p3.plus(diff).plus(diff)), viewport);
    } else {
        throw new Error("getTimeRange: Unexpected case!");
    }
}

export function getTimeRangeOld(start: DateTime, end: DateTime): TimeRange {

    const diff: Duration = end.diff(start);
    const secondsRange: number = diff.as('seconds');
    if (secondsRange > 0 && secondsRange <= 59) {
        console.log("case 1");
        return new TimeRange(start.set({ second: 0, millisecond: 0 }), end.set({ second: 59, millisecond: 999 }));
    }
    const minutesRange: number = diff.as('minutes');
    if (minutesRange > 0 && minutesRange <= 59) {
        const dt = new TimeRange(start.set({ minute: 0, second: 0, millisecond: 0 }), end.set({ minute: 59, second: 59, millisecond: 999 }));
        console.log("case 2: " + start.toISO() + "|" + dt.from.toISO());
        return dt;
    }
    const hoursRange: number = diff.as('hours');
    if (hoursRange >= 0 && hoursRange <= 23) {
        const dt = new TimeRange(start.set({ hour: 0, minute: 0, second: 0, millisecond: 0 }), end.set({ hour: 23, minute: 59, second: 59, millisecond: 999 }));
        console.log("case 3: " + dt.from.toISO());
        return dt;
    }
    const daysRange: number = diff.as('day');
    if (daysRange >= 0 && daysRange <= 31) {
        console.log("case 4");
        const newStart: DateTime = start.set({ day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 });
        const newEnd: DateTime = newStart.plus({ month: 1 }).minus({ millisecond: 1 });
        return new TimeRange(newStart, newEnd);
    }
    // const monthRange: number = diff.as('month');
    // if (monthRange >= 0 && monthRange <= 12) {
    //     return new TimeRange(start.set({ day: 1, hour: 0, minute: 0, second: 0 }), end.set({ hour: 23, minute: 59, second: 59 }));
    // }
    console.log("else");
    return null; //new Pair<Date, Date>(new Date(), new Date());
}