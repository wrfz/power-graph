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
import { Pair, TimeRange, GraphData, getTimeRangeOld, getCurrentDataTimeRange } from './GraphData'
import { mergeDeep, isNumber, toNumber, DateTimeUtils } from './utils';

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
    // TransformComponent,
    DataZoomComponent,
} from 'echarts/components';

// Features like Universal Transition and Label Layout
import { LabelLayout, UniversalTransition } from 'echarts/features';


// Import the Canvas renderer
// Note that including the CanvasRenderer or SVGRenderer is a required step
import { CanvasRenderer } from 'echarts/renderers';

import { DateTime, Duration } from "luxon";
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
    // TransformComponent,
    LabelLayout,
    UniversalTransition,
    CanvasRenderer
]);

declare global {
    interface Window {
        customCards?: any;
    }
}

type DataItem = {
    lu: number;
    s: number;
};

declare class HomeAssistant {
    states: any;
    callWS(request: any): any;
};

class PowerGraph extends HTMLElement {
    private _config: GraphConfig = null;
    private _hass: HomeAssistant;
    private _elements = { card: Element, style: Element };
    private _card: HTMLElement;
    private _infoBox: HTMLElement;
    private _chart: echarts.EChartsType;
    private _tid: ReturnType<typeof setTimeout> = null;
    private _series: any[] = [];
    private _range: TimeRange;
    private _resizeObserver;
    private _requestInProgress: boolean;
    private _data: GraphData;
    private _dataTimeRange: TimeRange;
    private _ctrlPressed: boolean;
    private _lastOption: any;

    constructor() {
        super();
        this._data = new GraphData();
        this._requestInProgress = false;
        this._ctrlPressed = false;

        this.createContent();
        this._resizeObserver = new ResizeObserver(entries => { this.resize(); });
    }

    public setConfig(config: GraphConfig): void {
        // console.error("setConfig");
        this._config = new GraphConfig(config);
        this._config.validate();
        this._range = new TimeRange(DateTime.local().minus({ hours: this._config.timRangeInHours }), DateTime.local());

        this._data.setQualities(this._config.qualities);

        this.clearRefreshInterval();
    }

    set hass(hass: HomeAssistant) {
        // console.log(hass);
        this._hass = hass;
    }

    private createContent(): void {
        //console.log("createContent");

        const thisGraph: PowerGraph = this;

        this._card = document.createElement("ha-card");
        this._card.setAttribute("id", "chart-container");

        // this._infoBox = document.createElement("div");
        // this._infoBox.setAttribute("id", "infoBox");

        var _style: Element = document.createElement("style");
        _style.textContent = `
            #chart-container {
                position: relative;
                height: 90%;
                overflow: hidden;
            }
            #infoBox {
                background-color: black;
                border:1px silver solid;
                width: 200px;
                height:800px;
                position:absolute;
                left:600px;
                top: 100px;
                overflow:auto;
                font-size: 12px;
            }
            `

        this.attachShadow({ mode: "open" });
        this.shadowRoot!.append(_style, this._card/*, this._infoBox*/);

        window.onkeydown = function (event) { thisGraph.onKeyDown(event); }
        window.onkeyup = function (event) { thisGraph.onKeyUp(event); }
    }

    private onKeyDown(event: KeyboardEvent) {
        if (event.key === "Control") {
            if (!this._ctrlPressed) {
                this._ctrlPressed = true;
                this.handleCtrl();
            }
        }
    }

    private onKeyUp(event: KeyboardEvent) {
        if (event.key === "Control") {
            this._ctrlPressed = false;
            this.handleCtrl();
        }
    }

    private handleCtrl() {
        this._chart.dispatchAction({
            type: "takeGlobalCursor",
            key: "dataZoomSelect",
            dataZoomSelectActive: this._ctrlPressed
        });
    }

    private onScroll(event: any) {
        //console.log(event);
        //const option = this._chart.getOption();
        //const dataZoom: any[] = option.dataZoom as any[];
        const { start, end } = event
        localStorage.setItem("dataZoom.startTime", start);
        //localStorage.setItem("dataZoom.endTime", endTime);

        //console.log(dataZoom);
        //console.log(event);

        // Scroll other charts
        // var zoom = myChart.getOption().dataZoom[0];
        // myOtherChart.dispatchAction({
        //     type: 'dataZoom',
        //     dataZoomIndex: 0,
        //     startValue: zoom.startValue,
        //     endValue: zoom.endValue
        // });

        if (start === 0) {
            this.requestData();
        } else {
            this.updateOptions({});
        }
    }

    private createChart(): void {
        console.log("createChart: " + this._range);
        const thisGraph: PowerGraph = this;

        this._chart = echarts.init(this._card, null, { renderer: this._config.renderer });
        this._chart.on('dataZoom', function (evt) { thisGraph.onScroll(evt); });

        //const startTime: number = toNumber(localStorage.getItem("dataZoom.startTime"), 75);
        //const endTime: number = toNumber(localStorage.getItem("dataZoom.endTime"), 100);
        //console.log(startTime, endTime);

        const smallDevice: boolean = this._card.clientWidth * this._card.clientWidth < 300000

        const options = {
            animation: this._config.animation,
            grid: {
                left: '2%',
                top: '3%',
                right: '2%',
                bottom: '30%'
            },
            toolbox: {
                feature: {
                    dataZoom: {
                        yAxisIndex: 'none'
                    }
                }
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
                formatter: function (name: string): string {
                    const entityConfig: EntityConfig = thisGraph._config.getEntityByName(name);
                    const entityIndex: number = thisGraph._config.getEntityConfigIndex(entityConfig);
                    const series: number[][] = thisGraph._data.getDataByTimeRange(entityIndex, thisGraph._dataTimeRange, thisGraph._data.getMaxTimeRange());
                    // console.error(`legend->formatter: ${thisGraph._dataTimeRange}`);
                    const value: number = series[series.length - 1][1];
                    return name + " (" + value + " " + thisGraph.getUnitOfMeasurement(entityConfig.entity) + ")";
                }
            },
            dataZoom: [
                {
                    type: 'inside',
                    filterMode: 'none',
                    // rangeMode: ['value', 'value'],
                    // startValue: this._range.from.toMillis(),
                    // endValue: this._range.to.toMillis(),
                    start: 50,
                    end: 100,
                    preventDefaultMouseMove: false
                },
                {
                    type: 'slider',
                    filterMode: 'none',
                    // rangeMode: ['value', 'value'],
                    // startValue: this._range.from.toMillis(),
                    // endValue: this._range.to.toMillis(),
                    start: 50,
                    end: 100,
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
                    formatter: (params: any[]) => {
                        var xTime = new Date(params[0].axisValue)
                        let tooltip = `<p>${xTime.toLocaleString()}</p><table>`;

                        const chart = this._chart;
                        const tooltipReducer = (prev: number[], curr: number[]) => {
                            return Math.abs(new Date(curr[0]).valueOf() - xTime.valueOf()) < Math.abs(new Date(prev[0]).valueOf() - xTime.valueOf()) ? curr : prev;
                        }

                        this._series.forEach((serie: any, index: number) => {
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
        this._lastOption = options;
        this._chart.setOption(options);
        if (this._config.logOptions) {
            console.log("setOptions: " + JSON.stringify(options));
        }

        const option: echarts.EChartsCoreOption = this._chart.getOption();
        const dataZoom: any[] = option.dataZoom as any[];
        // console.log(dataZoom);

        const millisecondsDiff: number = this._range.to.diff(this._range.from).toMillis() * 3;
        const diff: Duration = Duration.fromMillis(millisecondsDiff);
        const startTime: DateTime = this._range.to.minus(diff);
        const endTime: DateTime = this._range.to;
        this._range = new TimeRange(startTime, endTime);
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
            const range: TimeRange = this._data.getMaxTimeRange();

            if (startInPercent == 0) {
                const endDate: DateTime = range.from.minus({ millisecond: 1 })
                this._range = new TimeRange(endDate.minus({ hours: 24 }), endDate);
            } else {
                this._range = new TimeRange(range.to, DateTime.local());
            }
        }

        console.log(`requestData(entities: ${this._config.entities.length}, range: ${this._range} `);
        // console.log(`requestData(entities: ${this._config.entities.length}, start: ${this._range.start.toUnixInteger()}, end: ${this._range.end.toUnixInteger()} `);

        const request = {
            type: "history/history_during_period",
            start_time: this._range.from.toISO(),
            end_time: this._range.to.toISO(),
            minimal_response: true,
            no_attributes: true,
            entity_ids: entities
        };
        // console.log(request);

        this._requestInProgress = true;
        this._hass.callWS(request).then(this.responseData.bind(this), this.loaderFailed.bind(this));
    }

    private responseData(result: any): void {
        console.log("responseData >>")
        // console.log("start: " + this._range.start.toUnixInteger())
        // console.log("end: " + this._range.end.toUnixInteger())
        // console.log(result)

        const option: echarts.EChartsCoreOption = this._chart.getOption();

        //console.log("startTime: " + dataZoom[0].startTime);

        const thisCard: PowerGraph = this;
        const legends: string[] = [];

        let entityIndex = 0;
        for (const entityId in result) {
            const entity: EntityConfig = this._config.getEntityById(entityId);
            legends.push(entity.name || entity.entity)
            const arr: DataItem[] = result[entityId];
            // console.log("arr.len: " + arr.length);
            if (arr.length > 0) {
                const data: number[][] = [];
                for (let i = 1; i < arr.length; i++) {
                    data.push([Math.round(arr[i].lu * 1000), +arr[i].s]);
                }

                // console.log("ent: " + entityId + ", " + this._range);
                // if (this._range.from.toMillis() < data[0][0]) {
                //     // console.log("add from: " + this._range.from.toMillis());
                //     data.unshift([this._range.from.toMillis(), NaN]);
                // }
                // if (this._range.to.toMillis() > data[data.length - 1][0]) {
                //     // console.log("add to: " + this._range.to.toMillis());
                //     data.push([this._range.to.toMillis(), NaN]);
                // }

                this._data.add(entityIndex++, data);
            } else {
                console.log("data is empty");
            }
        }

        // console.log(this._data);

        const options = {
            // xAxis: {
            //     min: this._data.getTimeRange().from,
            //     max: this._data.getTimeRange().to
            // },
            legend: {
                data: legends
            }
        };

        this.updateOptions(options);

        if (isNumber(this._config.autorefresh) && this._tid == null) {
            // console.log("setInterval");
            //this._tid = setInterval(this.requestData.bind(this), +this._config.autorefresh * 1000);
        }

        this._requestInProgress = false;
    }

    private updateOptions(options: echarts.EChartsCoreOption): void {
        // console.error(`updateOptions: ${this._config.entities.length}`);
        const config: GraphConfig = this._config;

        const maxTimeRange: TimeRange = this._data.getMaxTimeRange();
        const displayedTimeRange: TimeRange = this.getDisplayedTimeRange();
        const lastDataTimeRange = new TimeRange(this._dataTimeRange);
        this._dataTimeRange = getCurrentDataTimeRange(maxTimeRange, displayedTimeRange);
        const displayedTimeRangeInPercent: Pair<number, number> = this.displayTimeRangeToPercent(this._dataTimeRange, displayedTimeRange);
        // console.log(`percent range: ${displayedTimeRangeInPercent}`);

        const dataChanged: boolean = !lastDataTimeRange.equals(this._dataTimeRange);

        let points = 0;
        let info = "";
        if (this._config.showInfo) {
            // info += `Current time: ${DateTime.local().toISO()}\n`;
            info += `Size: ${this._card.clientWidth} x ${this._card.clientHeight} \n`;
            info += `Renderer: ${this._config.renderer} \n`;
            info += `Sampling: ${this._config.sampling} \n`;
            info += '\n';
            info += `maxTimeRange:           ${maxTimeRange}\n`;
            info += `displayedTimeRange: ${displayedTimeRange}\n`;
            info += `dataTimeRange:           ${this._dataTimeRange}\n`;
            info += `displayedTimeRangeInPercent: ${displayedTimeRangeInPercent}\n`;
            info += '\n';
            info += 'Points:\n';
        }
        this._series = [];
        for (const entityConfig of this._config.entities) {
            const entityIndex: number = this._config.getEntityConfigIndex(entityConfig);
            const series: number[][] = this._data.getDataByTimeRange(entityIndex, this._dataTimeRange, this._data.getMaxTimeRange());

            points += series.length;
            info += `   ${entityConfig.entity}: ${series.length} \n`;
            info += `   min-max: ${new TimeRange(DateTime.fromMillis(series[0][0]), DateTime.fromMillis(series[series.length - 1][0]))} \n`;

            // let html = "count: " + series.length + "<br/>";
            // for (const point of series) {
            //     html += DateTimeUtils.toString(DateTime.fromMillis(point[0]), true) + ": " + point[1] + "<br/>";
            // }
            // this._infoBox.innerHTML = html;

            const line: any = {
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
            if (entityConfig.color) {
                mergeDeep(line, { lineStyle: { color: entityConfig.color } });
            }
            if (entityConfig.fillColor) {
                mergeDeep(line, { areaStyle: { color: entityConfig.fillColor } });
            }
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
        if (dataChanged) {
            console.error("data changed");

            this._lastOption = options;
            this._chart.setOption(options);
            if (this._config.logOptions) {
                console.log("setOptions: " + JSON.stringify(options));
            }
        }
    }

    /**
     * Returns the time range of the visible area
     * @returns Time range {@TimeRange}
     */
    private getDisplayedTimeRange(): TimeRange {
        const range: TimeRange = this._data.getMaxTimeRange();
        // const range: TimeRange = this._dataTimeRange != null ? this._dataTimeRange : this._data.getTimeRange();
        console.log("range: " + range);


        const option: echarts.EChartsCoreOption = this._chart.getOption();
        const dataZoom: any[] = option.dataZoom as any[];
        const startInPercent = dataZoom[0].start;
        const endInPercent = dataZoom[0].end;

        if (isNumber(startInPercent) && isNumber(endInPercent)) {
            // console.log(dataZoom);
            // console.log("startInPercent: " + startInPercent);
            // console.log("endInPercent: " + endInPercent);
            // console.log("range: " + range);

            return new TimeRange(
                DateTime.fromMillis(Math.round(range.from.toMillis() + (range.to.toMillis() - range.from.toMillis()) * startInPercent / 100)),
                DateTime.fromMillis(Math.round(range.from.toMillis() + (range.to.toMillis() - range.from.toMillis()) * endInPercent / 100))
            );
        } else {
            console.error("else case");
            const option: echarts.EChartsCoreOption = this._lastOption;
            const dataZoom: any[] = option.dataZoom as any[];
            return new TimeRange(DateTime.fromMillis(dataZoom[0].startValue), DateTime.fromMillis(dataZoom[0].endValue));
        }
    }

    private displayTimeRangeToPercent(maxTimeRange: TimeRange, displayedTimeRange: TimeRange): Pair<number, number> {
        const range: number = maxTimeRange.to.toMillis() - maxTimeRange.from.toMillis();
        return new Pair<number, number>(
            100.0 * displayedTimeRange.from.diff(maxTimeRange.from).toMillis() / range,
            100.0 * displayedTimeRange.to.diff(maxTimeRange.from).toMillis() / range);
    }

    private loaderFailed(error: string): void {
        console.log("Database request failure");
        console.log(error);
    }

    private clearRefreshInterval(): void {
        if (this._tid != null) {
            // console.log("clearInterval");
            clearInterval(this._tid);
            this._tid = null;
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

    private sleep(ms: number): Promise<number> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private getDeviceClass(entityId: string): string {
        return this._hass.states[entityId]?.attributes?.device_class;
    }

    private getUnitOfMeasurement(entityId: string): string {
        return this._hass.states[entityId]?.attributes?.unit_of_measurement;
    }

    private getStateClass(entityId: string): string {
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
