import { GraphConfig } from "./GraphConfig";
import { simplify } from './simplify';
import { DateTime, Duration } from "luxon";

export class Pair<T1, T2> {
    first: T1;
    second: T2;
    constructor(first: T1, second: T2) {
        this.first = first;
        this.second = second;
    }
};

class DataBlock {
    private _data: number[][];

    constructor(data?: number[][]) {
        this._data = data != null ? data : [];
    }

    getTimeRange(): Pair<DateTime, DateTime> {
        return new Pair<DateTime, DateTime>(
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
        return simplify(this._data, quality, true);
    }
}

class EntityData {
    private _graphData: GraphData;
    private _dataBlock: DataBlock[];

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

    add(data: number[][]): void {
        const dataBlock: DataBlock = this._dataBlock[0];
        dataBlock.add(data);

        let index = 0;
        for (const quality of this._graphData.getQualities()) {
            ++index;
            while (this._dataBlock.length <= index) {
                this._dataBlock.push(new DataBlock());
            }
            const sampledData: number[][] = dataBlock.simplify(quality);
            this._dataBlock[index].setData(sampledData);
        }
    }

    getTimeRange(): Pair<DateTime, DateTime> {
        const dataBlock: DataBlock = this._dataBlock[0];
        return dataBlock.getTimeRange();
    }
}

export class GraphData {
    private _entityData: EntityData[];
    private _qualities: number[];

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

    add(entityIndex: number, data: number[][]): void {
        while ((this._entityData.length - 1) < entityIndex) {
            this._entityData.push(new EntityData(this));
        }

        const entityData: EntityData = this._entityData[entityIndex];
        entityData.add(data);
    }

    getTimeRange(): Pair<DateTime, DateTime> {
        let minTime: DateTime = DateTime.local(3000, 1, 1);
        let maxTime: DateTime = DateTime.local(1980, 1, 1);
        for (const entityData of this._entityData) {
            const pair = entityData.getTimeRange();
            minTime = DateTime.min(minTime, pair.first);
            maxTime = DateTime.max(minTime, pair.second);
        }

        return new Pair<DateTime, DateTime>(minTime, maxTime);
    }
}

export function getTimeRange(start: DateTime, end: DateTime): Pair<DateTime, DateTime> {

    const diff: Duration = end.diff(start);
    const secondsRange: number = diff.as('seconds');
    if (secondsRange > 0 && secondsRange <= 59) {
        return new Pair<DateTime, DateTime>(start.set({ second: 0 }), end.set({ second: 59 }));
    }
    const minutesRange: number = diff.as('minutes');
    if (minutesRange > 0 && minutesRange <= 59) {
        return new Pair<DateTime, DateTime>(start.set({ minute: 0, second: 0 }), end.set({ minute: 59, second: 59 }));
    }
    const hoursRange: number = diff.as('hours');
    if (hoursRange >= 0 && hoursRange <= 23) {
        return new Pair<DateTime, DateTime>(start.set({ hour: 0, minute: 0, second: 0 }), end.set({ hour: 23, minute: 59, second: 59 }));
    }
    const daysRange: number = diff.as('day');
    if (daysRange >= 0 && daysRange <= 31) {
        const newStart: DateTime = start.set({ day: 1, hour: 0, minute: 0, second: 0 });
        const newEnd: DateTime = newStart.plus({ month: 1 }).minus({ second: 1 });
        return new Pair<DateTime, DateTime>(newStart, newEnd);
    }
    // const monthRange: number = diff.as('month');
    // if (monthRange >= 0 && monthRange <= 12) {
    //     return new Pair<DateTime, DateTime>(start.set({ day: 1, hour: 0, minute: 0, second: 0 }), end.set({ hour: 23, minute: 59, second: 59 }));
    // }

    return null; //new Pair<Date, Date>(new Date(), new Date());
}