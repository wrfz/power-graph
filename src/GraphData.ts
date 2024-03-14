import { GraphConfig } from "./GraphConfig";
import { simplify } from './simplify';

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

    getTimeRange(): Pair<number, number> {
        return new Pair<number, number>(this._data[0][0], this._data[this._data.length - 1][0]);
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

    getTimeRange(): Pair<number, number> {
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

    getTimeRange(): Pair<number, number> {
        let minTime: number = Number.MAX_SAFE_INTEGER;
        let maxTime: number = Number.MIN_SAFE_INTEGER;
        for (const entityData of this._entityData) {
            const pair = entityData.getTimeRange();
            minTime = Math.min(minTime, pair.first);
            maxTime = Math.max(minTime, pair.second);
        }

        return new Pair<number, number>(minTime, maxTime);
    }
}