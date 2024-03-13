import {
    css,
    CSSResult,
    CSSResultGroup,
    html,
    LitElement,
    PropertyValues,
    TemplateResult,
    unsafeCSS,
} from "lit";

import { GraphConfig, EntityConfig } from './GraphConfig';
import { Pair, GraphData } from './GraphData'
import { mergeDeep, isNumber, toNumber, subHours } from './utils';

import * as echarts from 'echarts/core';

// Import bar charts, all suffixed with Chart
import { BarChart, LineChart } from 'echarts/charts';

import {
    TitleComponent,
    ToolboxComponent,
    TooltipComponent,
    GraphicComponent,
    GridComponent,
    DatasetComponent,
    LegendComponent,
    TransformComponent,
    DataZoomComponent,
} from 'echarts/components';

// Features like Universal Transition and Label Layout
import { LabelLayout, UniversalTransition } from 'echarts/features';


// Import the Canvas renderer
// Note that including the CanvasRenderer or SVGRenderer is a required step
import { CanvasRenderer } from 'echarts/renderers';

import { ResizeObserver } from "@juggle/resize-observer";


// Register the required components
echarts.use([
    BarChart,
    TitleComponent,
    ToolboxComponent,
    TooltipComponent,
    GraphicComponent,
    GridComponent,
    DatasetComponent,
    DataZoomComponent,
    LegendComponent,
    LineChart,
    TransformComponent,
    LabelLayout,
    UniversalTransition,
    CanvasRenderer
]);

declare global {
    interface Window {
        customCards?: any;
    }
}

class TimeRange {
    start: Date;
    end: Date;

    constructor(start: Date, end: Date) {
        this.start = start;
        this.end = end;
    }
};

type DataItem = {
    lu: number;
    s: number;
};

class PowerGraph extends HTMLElement {
    private _config: GraphConfig;
    private _hass;
    private _elements = { card: Element, style: Element };
    private _card: HTMLElement;
    private _chart: echarts.EChartsType;
    private _tid: number = 0;
    private _series: any[] = [];
    private _range: TimeRange;
    private _resizeObserver;
    private _requestInProgress: boolean;
    private _data: GraphData;
    private _currentSeriesQualityIndex: number;

    constructor() {
        super();
        this._data = new GraphData();
        this._currentSeriesQualityIndex = 0;
        this._requestInProgress = false;

        this.createContent();

        //this._range = new PowerGraph.TimeRange(subHours(new Date(), 1 * 24), new Date());
        this._resizeObserver = new ResizeObserver(entries => { this.resize(); });
    }

    public setConfig(config: GraphConfig): void {
        //console.log("setConfig");
        this._config = new GraphConfig(config);
        this._config.validate();
        //this._range = new PowerGraph.TimeRange(this._config.start, new Date());
        this._range = new TimeRange(subHours(new Date(), this._config.timRangeInHours), new Date());
        console.log(this._range);

        this._data.setQualities(this._config.qualities);

        this.clearRefreshInterval();
    }

    set hass(hass) {
        //console.log("hass");
        this._hass = hass;
    }

    private createContent(): void {
        //console.log("createContent");

        this._card = document.createElement("ha-card");
        this._card.setAttribute("id", "chart-container");

        var _style: Element = document.createElement("style");
        _style.textContent = `
            #chart-container {
                position: relative;
                height: 90%;
                overflow: hidden;
            }`

        this.attachShadow({ mode: "open" });
        this.shadowRoot!.append(_style, this._card);
    }

    private onScroll(event) {
        //console.log(event);
        //const option = this._chart.getOption();
        //const dataZoom: any[] = option.dataZoom as any[];
        const { start, end } = event
        //localStorage.setItem("dataZoom.startTime", startTime);
        //localStorage.setItem("dataZoom.endTime", endTime);

        //console.log(dataZoom);
        //console.log(event);
        if (start === 0) {
            this.requestData();
        } else {
            this.updateOptions({});
        }
    }

    private createChart(): void {
        console.log("createChart: " + this._config.renderer);
        let thisGraph: PowerGraph = this;

        this._chart = echarts.init(this._card, null, { renderer: this._config.renderer });
        console.log(this);
        //let chart: echarts.ECharts = this._chart;
        this._chart.on('datazoom', function (evt) { thisGraph.onScroll(evt); });

        //const startTime: number = toNumber(localStorage.getItem("dataZoom.startTime"), 75);
        //const endTime: number = toNumber(localStorage.getItem("dataZoom.endTime"), 100);
        //console.log(startTime, endTime);

        const size = this._card.clientWidth * this._card.clientWidth;
        //console.log("size: " + size);

        const smallDevice: boolean = this._card.clientWidth * this._card.clientWidth < 300000

        let options = {
            animation: this._config.animation,
            grid: {
                left: '2%',
                top: '3%',
                right: '2%',
                bottom: '30%'
            },
            xAxis: {
                type: 'time',
                boundaryGap: false,
                triggerEvent: true,
                splitLine: {
                    lineStyle: {
                        color: "#484753"
                    }
                }
            },
            yAxis: {
                type: 'value',
                splitLine: {
                    lineStyle: {
                        color: "#333"
                    }
                }
            },
            legend: {
                formatter: function (name) {
                    const entityConfig: EntityConfig = thisGraph._config.getEntityByName(name);
                    const entityIndex: number = thisGraph._config.getEntityConfigIndex(entityConfig);
                    const series: number[][] = thisGraph._data.getData(entityIndex, thisGraph._currentSeriesQualityIndex);
                    const value: number = series[series.length - 1][1];
                    return name + " (" + value + " " + thisGraph.getUnitOfMeasurement(entityConfig.entity) + ")";
                }
            },
            dataZoom: [
                {
                    type: 'inside',
                    // rangeMode: ['value', 'value'],
                    startValue: this._range.start.getTime(),
                    endValue: this._range.end.getTime(),
                    preventDefaultMouseMove: false
                },
                {
                    type: 'slider',
                    // rangeMode: ['value', 'value'],
                    startValue: this._range.start.getTime(),
                    endValue: this._range.end.getTime(),
                    showDetail: false,
                    emphasis: {
                        handleStyle: {
                            borderColor: 'red',
                            color: 'red'
                        }
                    },
                    brushStyle: {
                        color: 'rgba(0, 100, 0, 50)'
                    }
                }
            ]
        };
        if (this._config.showTooltip) {
            mergeDeep(options, {
                tooltip: {
                    trigger: 'axis',
                    triggerOn: smallDevice ? 'click' : 'mousemove|click',
                    axisPointer: {
                        type: 'cross'
                    },
                    formatter: (params) => {
                        var xTime = new Date(params[0].axisValue)
                        let tooltip = `<p>${xTime.toLocaleString()}</p><table>`;

                        let chart = this._chart;
                        const tooltipReducer = (prev, curr) => {
                            return Math.abs(new Date(curr[0]).valueOf() - xTime.valueOf()) < Math.abs(new Date(prev[0]).valueOf() - xTime.valueOf()) ? curr : prev;
                        }

                        this._series.forEach((serie, index) => {
                            const color: CSSResult = unsafeCSS(chart.getVisual({ seriesIndex: index }, 'color'));
                            const style: CSSResult = css`
                                display: inline-block;
                                margin-right: 5px;
                                border-radius: 10px;
                                width: 9px;
                                height: 9px;
                                background-color: ${color};
                            `;

                            // TODO: Use binary search to find the closest value
                            const value: number = serie.data.reduce(tooltipReducer)[1]
                            tooltip += `<tr><td><span style="${style}"></span></td>`
                            tooltip += `<td>${serie.name}</td><td><b>${value}</b></td></tr>`;
                        });
                        tooltip += `</table>`;
                        return tooltip;
                    },
                    textStyle: {
                        fontSize: 12
                    }
                }
            });
        }
        if (this._config.showInfo) {
            mergeDeep(options, {
                graphic: {
                    id: 'info',
                    type: 'text',
                    z: 0,
                    left: 100,
                    top: 100,
                    draggable: true,
                    style: {
                        fill: '#AAA',
                        width: 220
                    }
                }
            });
        }
        if (this._config.title) {
            mergeDeep(options, {
                title: {
                    show: true,
                    text: this._config.title
                }
            });
        }
        this._chart.setOption(options);
        if (this._config.logOptions) {
            console.log("setOptions: " + JSON.stringify(options));
        }

        this.requestData();
    }

    private requestData(): void {
        if (this._requestInProgress) {
            console.error("Request already in progress!");
            return;
        }

        const entities: string[] = [];
        for (const entity of this._config.entities) {
            entities.push(entity.entity);
        }

        //console.log(this._range);
        if (this._data.hasData()) {
            const option: echarts.EChartsCoreOption = this._chart.getOption();
            const dataZoom: any[] = option.dataZoom as any[];
            const startInPercent = dataZoom[0].start;

            if (startInPercent == 0) {
                console.log("request past data");
                const timeRange: Pair<number, number> = this._data.getCurrentTimeRange();
                const endDate: Date = new Date(timeRange.v1 - 1);
                this._range = new TimeRange(subHours(endDate, 24), endDate);
            } else {
                console.log("request new data");
                this._range.end = new Date();

                const timeRange: Pair<number, number> = this._data.getCurrentTimeRange();
                const maxAvailableTime: number = timeRange.v2;
                this._range = new TimeRange(new Date(maxAvailableTime), new Date());
            }
        }

        console.log(`requestData(entities: ${this._config.entities.length}, start: ${this._range.start.toISOString()}, end: ${this._range.end.toISOString()} `);
        console.log(`requestData(entities: ${this._config.entities.length}, start: ${this._range.start.getTime()}, end: ${this._range.end.getTime()} `);

        const request = {
            type: "history/history_during_period",
            start_time: this._range.start.toISOString(),
            end_time: this._range.end.toISOString(),
            minimal_response: true,
            no_attributes: true,
            entity_ids: entities
        };
        //console.log(request);

        this._requestInProgress = true;
        this._hass.callWS(request).then(this.dataResponse.bind(this), this.loaderFailed.bind(this));
    }

    private dataResponse(result): void {
        console.log("dataResponse >>")
        //console.log(result)

        const option: echarts.EChartsCoreOption = this._chart.getOption();

        //console.log("startTime: " + dataZoom[0].startTime);

        const thisCard: PowerGraph = this;

        const legends: string[] = [];

        let seriesIndex = 0;
        for (const entityId in result) {
            const entity: EntityConfig = this._config.getEntityById(entityId);
            legends.push(entity.name || entity.entity)
            const arr: DataItem[] = result[entityId];

            //console.log("startTime2: " + startTime);
            //console.log("endTime2: " + endTime);

            const data: number[][] = [];
            for (let i = 1; i < arr.length; i++) {
                const time: number = Math.round(arr[i].lu * 1000);
                data.push([time, +arr[i].s]);
            }

            this._data.add(seriesIndex, data);

            seriesIndex++;
        }

        const options = {
            legend: {
                data: legends
            }
        };

        this.updateOptions(options);

        if (isNumber(this._config.autorefresh) && this._tid == 0) {
            //console.log("setInterval");
            this._tid = setInterval(this.requestData.bind(this), +this._config.autorefresh * 1000);
        }

        this._requestInProgress = false;
    }

    private updateOptions(options: echarts.EChartsCoreOption): void {

        const config: GraphConfig = this._config;
        const displayedTimeRange: Pair<number, number> = this.getDisplayedTimeRange();
        const displayedTimeRangeNumber: number = displayedTimeRange.v2 - displayedTimeRange.v1;
        console.log("displayedTimeRangeNumber: " + displayedTimeRangeNumber + ", xx: " + (displayedTimeRangeNumber / 1000 / 60 / 60));
        this._currentSeriesQualityIndex = (displayedTimeRangeNumber > (3 * 24 * 60 * 60 * 1000)) ? 1 : 0;

        console.log("updateOptions: " + this._currentSeriesQualityIndex);

        let points = 0;
        let info = "";
        if (this._config.showInfo) {
            info += `Size: ${this._card.clientWidth} x ${this._card.clientHeight} \n`;
            info += `Renderer: ${this._config.renderer} \n`;
            info += `Sampling: ${this._config.sampling} \n`;
            info += `currentSeriesQualityIndex: ${this._currentSeriesQualityIndex}\n`;
            info += 'Points:\n';
        }
        this._series = [];
        for (const entityConfig of this._config.entities) {
            const entityIndex: number = this._config.getEntityConfigIndex(entityConfig);
            const series: number[][] = this._data.getData(entityIndex, this._currentSeriesQualityIndex);
            const seriesLength: number = series.length;
            points += seriesLength;
            info += `   ${entityConfig.entity}: ${seriesLength} \n`;

            const line = {
                name: entityConfig.name || entityConfig.entity,
                type: 'line',
                smooth: false,
                symbol: 'none',
                silient: true,
                lineStyle: {
                    width: 1
                },
                step: 'end',
                data: series
            };
            if (this._config.shadow || entityConfig.shadow) {
                Object.assign(line, {
                    lineStyle: {
                        width: 3,
                        shadowColor: 'rgba(0,0,0,0.3)',
                        shadowBlur: 10,
                        shadowOffsetY: 8
                    }
                });
            }
            if (this._config.sampling) {
                mergeDeep(line, { sampling: 'lttb' });
            }
            if (this._config.fillAread) {
                mergeDeep(line, { areaStyle: {} });
            }

            this._series.push(line);
        }

        mergeDeep(options, {
            series: this._series
        });

        if (this._config.showInfo) {
            info += `   sum: ${points} `;
            mergeDeep(options, {
                graphic: {
                    id: 'info',
                    style: {
                        text: info
                    }
                }
            });
        }
        this._chart.setOption(options);
        if (this._config.logOptions) {
            console.log("setOptions: " + JSON.stringify(options));
        }
    }

    private getCurrentTimeRange(): Pair<number, number> {
        return this._data.getCurrentTimeRange();
    }

    private getDisplayedTimeRange(): Pair<number, number> {
        const timeRange: Pair<number, number> = this.getCurrentTimeRange();

        const option: echarts.EChartsCoreOption = this._chart.getOption();
        const dataZoom: any[] = option.dataZoom as any[];
        const startInPercent = dataZoom[0].start;
        const endInPercent = dataZoom[0].end;

        return new Pair<number, number>(
            timeRange.v1 + (timeRange.v2 - timeRange.v1) * startInPercent / 100,
            timeRange.v1 + (timeRange.v2 - timeRange.v1) * endInPercent / 100
        );
    }

    private loaderFailed(error): void {
        console.log("Database request failure");
        console.log(error);
    }

    private getMinTime(data: DataItem[]): number | null {
        for (let index = 0; index < data.length; ++index) {
            let time: number = data[index].lu;
            if (isNumber(time)) {
                return time;
            }
        }
        return null;
    }

    private getMaxTime(data: DataItem[]): number | null {
        for (let index = data.length - 1; index >= 0; --index) {
            let time: number = data[index].lu;
            if (isNumber(time)) {
                //console.log("getMaxTime: " + time);
                return time;
            }
        }
        return null;
    }

    private clearRefreshInterval(): void {
        if (this._tid != 0) {
            //console.log("clearInterval");
            clearTimeout(this._tid);
            this._tid = 0;
        }
    }

    resize(): void {
        if (this._chart == null) {
            // Create chart when the card size is known
            this.createChart();
        }
        // console.log(`resize(${ this._card.clientWidth }, ${ this._card.clientHeight })`)
        this._chart.resize();
    }

    getCardSize(): number {
        return 3;
    }

    // configuration defaults
    static getStubConfig(): object {
        return {
            title: "PV Leistung",
            entities: [
                {
                    entity: "sensor.sofar_15ktl_pv_power_total",
                    name: "Power Total"
                },
                {
                    entity: "sensor.sofar_15ktl_pv_power_1",
                    name: "Haus 1"
                },
                {
                    entity: "sensor.sofar_15ktl_pv_power_2",
                    name: "Haus 2"
                }
            ],
            autorefresh: 10
        }
    }

    private sleep(ms): Promise<number> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private getDeviceClass(entityId): string {
        return this._hass.states[entityId]?.attributes?.device_class;
    }

    private getUnitOfMeasurement(entityId): string {
        return this._hass.states[entityId]?.attributes?.unit_of_measurement;
    }

    private getStateClass(entityId): string {
        return this._hass.states[entityId]?.attributes?.state_class;
    }

    connectedCallback(): void {
        //console.log("connectedCallback");
        this._resizeObserver.observe(this._card);
    }
    disconnectedCallback(): void {
        //console.log("disconnectedCallback");
        this._resizeObserver.unobserve(this._card);
    }
}

customElements.define('power-graph', PowerGraph);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "power-graph",
    name: "Power Graph Card",
    description: "An interactive history viewer card",
    documentationURL: "https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/", // Adds a help link in the frontend card editor
});
