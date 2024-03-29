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

import { IPowerGraph } from './PowerGraph'
import { GraphConfig, PowerGraphConfig, EntityConfig } from './GraphConfig'
import * as echarts from 'echarts/core';
import { DataZoomComponentOption } from 'echarts/types/dist/echarts';

import { mergeDeep, isNumber, toNumber, DateTimeUtils } from './utils';
import { Pair, TimeRange, GraphData, getCurrentDataTimeRange } from './GraphData'
import { DateTime, Duration } from "luxon";

type DataItem = {
    lu: number;
    s: number;
};

export class Graph {
    private thisGraph: Graph;
    private _powerGraph: IPowerGraph;
    private _chart: echarts.EChartsType;

    private _globalConfig: PowerGraphConfig;
    private _graphConfig: GraphConfig;
    private _hass: HomeAssistant;
    private _card: HTMLElement;

    private _data: GraphData;
    private _dataTimeRange: TimeRange;

    private _requestInProgress: boolean;
    private _tid: ReturnType<typeof setTimeout> = null;
    private _lastOption: any;
    private _series: any[] = [];
    private _ctrlPressed: boolean = false;

    constructor(powerGraph: IPowerGraph, graphConfig: GraphConfig) {
        this._powerGraph = powerGraph;
        this._globalConfig = powerGraph.getConfig();
        this._graphConfig = graphConfig;
        this._requestInProgress = false;
        this._data = new GraphData();

        this.clearRefreshInterval();
    }

    setHass(hass: HomeAssistant) {
        this._hass = hass;
    }

    createContent(mainContener: Element): void {
        // console.log("Graph::createContent");

        this._card = document.createElement("ha-card");
        this._card.setAttribute("id", "chart-container");
        this._card.style.height = this._graphConfig.getHeight() + "px";

        mainContener.append(this._card);

        const thisGraph: Graph = this;

        // window.onkeydown = function (event) { thisGraph.onKeyDown(event); }
        // window.onkeyup = function (event) { thisGraph.onKeyUp(event); }

        document.addEventListener('keydown', function (event) { thisGraph.onKeyDown(event); }, false);
        document.addEventListener('keyup', function (event) { thisGraph.onKeyUp(event); }, false);
    }

    private createChart(): void {
        // console.log("Graph::createChart: " + this._powerGraph.getTimeRange());
        const thisGraph: Graph = this;

        this._chart = echarts.init(this._card, null, { renderer: this._globalConfig.renderer });
        this._chart.on('dataZoom', function (evt) { thisGraph.onScroll(evt); });
        this._chart.on('dblclick', function (evt) { thisGraph.onDoubleClick(evt); });

        //const startTime: number = toNumber(localStorage.getItem("dataZoom.startTime"), 75);
        //const endTime: number = toNumber(localStorage.getItem("dataZoom.endTime"), 100);
        //console.log(startTime, endTime);

        const clientArea: Pair<number, number> = this._powerGraph.getClientArea();
        const smallDevice: boolean = clientArea.first * clientArea.second < 300000

        const options = {
            animation: this._globalConfig.animation,
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
                    const entityConfig: EntityConfig = thisGraph._graphConfig.getEntityByName(name);
                    const entityIndex: number = thisGraph._graphConfig.getEntityConfigIndex(entityConfig);
                    const series: number[][] = thisGraph._data.getDataByTimeRange(entityIndex, thisGraph._dataTimeRange, thisGraph._data.getMaxTimeRange(), thisGraph._globalConfig.numberOfPoints);
                    // console.error(`legend->formatter: ${thisGraph._dataTimeRange}`);
                    const value: number = series[series.length - 1][1];
                    return name + " (" + value + " " + thisGraph._powerGraph.getUnitOfMeasurement(entityConfig.entity) + ")";
                }
            },
            dataZoom: [
                {
                    type: 'inside',
                    filterMode: 'none',
                    zoomLock: !this._powerGraph.isMobile(),
                    start: 50,
                    end: 100
                    // zoomOnMouseWheel: smallDevice ? true : 'ctrl',
                    // moveOnMouseWheel: false,
                    // disabled: !this._ctrlPressed && !smallDevice,
                },
                // {
                //     type: 'slider',
                //     filterMode: 'none',
                //     // rangeMode: ['value', 'value'],
                //     // startValue: this._range.from.toMillis(),
                //     // endValue: this._range.to.toMillis(),
                //     start: 50,
                //     end: 100,
                //     showDetail: false,
                //     emphasis: {
                //         handleStyle: {
                //             borderColor: 'red',
                //             color: 'red'
                //         }
                //     },
                //     brushStyle: {
                //         color: 'rgba(0, 100, 0, 50)'
                //     }
                // }
            ]
        };
        if (this._globalConfig.showTooltip) {
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
        if (this._globalConfig.showInfo) {
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
        if (this._globalConfig.title) {
            mergeDeep(options, {
                title: {
                    show: true,
                    text: this._globalConfig.title
                }
            });
        }
        this._lastOption = options;
        this._chart.setOption(options);
        if (this._globalConfig.logOptions) {
            console.log("setOptions: " + JSON.stringify(options));
        }

        const option: echarts.EChartsCoreOption = this._chart.getOption();
        const dataZoom: any[] = option.dataZoom as any[];
        // console.log(dataZoom);

        const millisecondsDiff: number = this._powerGraph.getTimeRange().to.diff(this._powerGraph.getTimeRange().from).toMillis() * 3;
        const diff: Duration = Duration.fromMillis(millisecondsDiff);
        const startTime: DateTime = this._powerGraph.getTimeRange().to.minus(diff);
        const endTime: DateTime = this._powerGraph.getTimeRange().to;

        this._powerGraph.setTimeRange(new TimeRange(startTime, endTime));

        this.requestData();
    }

    private requestData(): void {
        if (this._requestInProgress) {
            console.error("Request already in progress!");
            return;
        }

        const entities: string[] = [];
        for (const entity of this._graphConfig.entities) {
            entities.push(entity.entity);
        }

        //console.log(this._range);
        if (this._data.hasData()) {
            const option: echarts.EChartsCoreOption = this._chart.getOption();
            const dataZoom: any[] = option.dataZoom as any[];
            const startInPercent = dataZoom[0].start;
            const range: TimeRange = this._data.getMaxTimeRange();

            console.error("fix me!!!");

            if (startInPercent == 0) {
                const endDate: DateTime = range.from.minus({ millisecond: 1 })
                // this._range = new TimeRange(endDate.minus({ hours: 24 }), endDate);
            } else {
                // this._range = new TimeRange(range.to, DateTime.local());
            }
        }

        // console.log(`requestData(entities: ${this._globalConfig.entities.length}, range: ${this._range} `);
        // console.log(`requestData(entities: ${this._globalConfig.entities.length}, start: ${this._range.start.toUnixInteger()}, end: ${this._range.end.toUnixInteger()} `);

        const request = {
            type: "history/history_during_period",
            start_time: this._powerGraph.getTimeRange().from.toISO(),
            end_time: this._powerGraph.getTimeRange().to.toISO(),
            minimal_response: true,
            no_attributes: true,
            entity_ids: entities
        };
        // console.log(request);

        this._requestInProgress = true;
        this._hass.callWS(request).then(this.responseData.bind(this), this.loaderFailed.bind(this));
    }

    private responseData(result: any): void {
        // console.log("responseData >>")
        // console.log("start: " + this._range.start.toUnixInteger())
        // console.log("end: " + this._range.end.toUnixInteger())
        // console.log(result)

        const option: echarts.EChartsCoreOption = this._chart.getOption();

        //console.log("startTime: " + dataZoom[0].startTime);

        const thisCard: Graph = this;
        const legends: string[] = [];

        let entityIndex = 0;
        for (const entityId in result) {
            const entity: EntityConfig = this._graphConfig.getEntityById(entityId);
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

        if (isNumber(this._globalConfig.autorefresh) && this._tid == null) {
            // console.log("setInterval");
            //this._tid = setInterval(this.requestData.bind(this), +this._globalConfig.autorefresh * 1000);
        }

        this._requestInProgress = false;
        // console.log("responseData <<")
    }

    private loaderFailed(error: string): void {
        console.error("Database request failure");
        console.error(error);
    }

    private updateOptions(options: echarts.EChartsCoreOption): void {
        // console.info(`updateOptions: ${this._globalConfig.entities.length} >>`);
        const config: PowerGraphConfig = this._globalConfig;

        const maxTimeRange: TimeRange = this._data.getMaxTimeRange();
        const displayedTimeRange: TimeRange = this.getDisplayedTimeRange();
        const lastDataTimeRange = new TimeRange(this._dataTimeRange);
        this._dataTimeRange = getCurrentDataTimeRange(maxTimeRange, displayedTimeRange);
        const displayedTimeRangeInPercent: Pair<number, number> = this.displayTimeRangeToPercent(this._dataTimeRange, displayedTimeRange);
        // console.log(`percent range: ${displayedTimeRangeInPercent}`);

        const dataChanged: boolean = !lastDataTimeRange.equals(this._dataTimeRange);

        let points = 0;
        let info = "";
        if (this._globalConfig.showInfo) {
            const clientArea: Pair<number, number> = this._powerGraph.getClientArea();
            // info += `Current time: ${DateTime.local().toISO()}\n`;
            info += `IsMobile: ${this._powerGraph.isMobile()}\n`;
            info += `Size: ${clientArea.first} x ${clientArea.second} \n`;
            info += `Renderer: ${this._globalConfig.renderer} \n`;
            info += `Sampling: ${this._globalConfig.sampling} \n`;
            info += '\n';
            info += `maxTimeRange:           ${maxTimeRange}\n`;
            info += `displayedTimeRange: ${displayedTimeRange}\n`;
            info += `dataTimeRange:           ${this._dataTimeRange}\n`;
            info += `displayedTimeRangeInPercent: ${displayedTimeRangeInPercent}\n`;
            info += '\n';
            info += 'Points:\n';
        }
        this._series = [];
        for (const entityConfig of this._graphConfig.entities) {
            const entityIndex: number = this._graphConfig.getEntityConfigIndex(entityConfig);
            const series: number[][] = this._data.getDataByTimeRange(entityIndex, this._dataTimeRange, this._data.getMaxTimeRange(), this._globalConfig.numberOfPoints);

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
            if (this._globalConfig.shadow || entityConfig.shadow) {
                Object.assign(line, {
                    lineStyle: {
                        width: 3,
                        shadowColor: 'rgba(0,0,0,0.3)',
                        shadowBlur: 10,
                        shadowOffsetY: 8
                    }
                });
            }
            if (this._globalConfig.sampling) {
                mergeDeep(line, { sampling: 'lttb' });
            }
            if (this._globalConfig.fillAread) {
                mergeDeep(line, { areaStyle: {} });
            }

            this._series.push(line);
        }

        if (dataChanged) {
            mergeDeep(options, {
                series: this._series
            });
        }

        if (this._globalConfig.showInfo) {
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

        this._lastOption = options;
        this._chart.setOption(options);
        if (this._globalConfig.logOptions) {
            console.log("setOptions: " + JSON.stringify(options));
        }
        // console.info("updateOptions <<");
    }


    /**
     * Returns the time range of the visible area
     * @returns Time range {@TimeRange}
     */
    private getDisplayedTimeRange(): TimeRange {
        const range: TimeRange = this._data.getMaxTimeRange();
        const option: echarts.EChartsCoreOption = this._chart.getOption();
        const dataZoom: any[] = option.dataZoom as any[];

        return new TimeRange(
            DateTime.fromMillis(Math.round(range.from.toMillis() + (range.to.toMillis() - range.from.toMillis()) * dataZoom[0].start / 100)),
            DateTime.fromMillis(Math.round(range.from.toMillis() + (range.to.toMillis() - range.from.toMillis()) * dataZoom[0].end / 100))
        );
    }

    private displayTimeRangeToPercent(maxTimeRange: TimeRange, displayedTimeRange: TimeRange): Pair<number, number> {
        const range: number = maxTimeRange.to.toMillis() - maxTimeRange.from.toMillis();
        return new Pair<number, number>(
            100.0 * displayedTimeRange.from.diff(maxTimeRange.from).toMillis() / range,
            100.0 * displayedTimeRange.to.diff(maxTimeRange.from).toMillis() / range);
    }

    resize(): void {
        // console.log("Graph::resize");
        if (this._chart == null) {
            // Create chart when the card size is known
            this.createChart();
        }
        // console.log(`resize(${ this._card.clientWidth }, ${ this._card.clientHeight })`)
        this._chart.resize();
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

    private onDoubleClick(event: any) {
        console.log("onDoubleClick");
        this._chart.dispatchAction({
            type: "takeGlobalCursor",
            key: "dataZoomSelect",
            dataZoomSelectActive: true
        });
    }

    private clearRefreshInterval(): void {
        if (this._tid != null) {
            // console.log("clearInterval");
            clearInterval(this._tid);
            this._tid = null;
        }
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
        // Toggle zoomLock
        const option: echarts.EChartsCoreOption = this._chart.getOption();
        const dataZoom = option.dataZoom as DataZoomComponentOption[];
        const inside: any = dataZoom[0];
        mergeDeep(inside, { zoomLock: !this._ctrlPressed });

        this._chart.setOption(option);

        this._chart.dispatchAction({
            type: "takeGlobalCursor",
            key: "dataZoomSelect",
            dataZoomSelectActive: this._ctrlPressed
        });
    }
}