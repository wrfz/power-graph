
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

import * as echarts from 'echarts/core';

// Import bar charts, all suffixed with Chart
import { BarChart, LineChart } from 'echarts/charts';

import {
    TitleComponent,
    ToolboxComponent,
    TooltipComponent,
    GridComponent,
    DatasetComponent,
    LegendComponent,
    TransformComponent,
    DataZoomComponent
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
function isNumber(value?: string | number): boolean {
    return (value != null && value !== '' && !isNaN(Number(value.toString())));
}

function toNumber(value: string | null, defaultValue: number): number {
    return value != null && isNumber(value) ? +value : defaultValue;
}

function subHours(date: Date, hours: number) {
    const hoursToAdd = hours * 60 * 60 * 1000;
    date.setTime(date.getTime() - hoursToAdd);
    return date;
}

class PowerGraph extends HTMLElement {
    static TimeRange = class {
        start: Date;
        end: Date;

        constructor(start: Date, end: Date) {
            this.start = start;
            this.end = end;
        }
    };

    private _config: GraphConfig;
    private _hass;
    private _elements = { card: Element, style: Element };
    private _card: HTMLElement;
    private _chart: echarts.EChartsType;
    private _tid: number = 0;
    private _series: any[] = [];
    private _range;
    private _resizeObserver;

    constructor() {
        super();
        this.createContent();
        this._range = new PowerGraph.TimeRange(subHours(new Date(), 100 * 24), new Date());
        this._resizeObserver = new ResizeObserver(entries => { this.resize(); });
    }

    public setConfig(config: GraphConfig): void {
        //console.log("setConfig");
        this._config = new GraphConfig(config);
        this._config.validate();
        this._range = new PowerGraph.TimeRange(this._config.start, new Date());

        this.clearRefreshInterval();
    }

    set hass(hass) {
        //console.log("hass");
        this._hass = hass;
    }

    private createContent() {
        //console.log("createContent");

        this._card = document.createElement("div");
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

    private createChart() {
        //console.log("createChart");

        //console.log('create chart object');

        this._chart = echarts.init(this._card, null, { renderer: 'svg' });
        let chart: echarts.ECharts = this._chart;
        this._chart.on('datazoom', function (evt) {
            const option = chart.getOption();
            const dataZoom: any[] = option.dataZoom as any[];
            const { startTime, endTime } = dataZoom[0]
            localStorage.setItem("dataZoom.startTime", startTime);
            localStorage.setItem("dataZoom.endTime", endTime);

            console.log(startTime, endTime);
        });

        const startTime: number = toNumber(localStorage.getItem("dataZoom.startTime"), 75);
        const endTime: number = toNumber(localStorage.getItem("dataZoom.endTime"), 100);
        console.log(startTime, endTime);

        let options = {
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross'
                },
                //triggerOn: 'click',
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
            dataZoom: [
                {
                    type: 'inside',
                    start: 0,
                    end: 100
                },
                {
                    start: 0,
                    end: 100
                }
            ]
        };
        if (this._config.title) {
            Array.prototype.concat.call(options, { title: this._config.title })
        }
        this._chart.setOption(options);
        //this._chart.resize();

        this.requestData();
    }

    private formatDate(date: Date): string {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');;
        const minutes = date.getMinutes().toString().padStart(2, '0');;
        const seconds = date.getSeconds().toString().padStart(2, '0');;
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
    }

    private requestData() {
        //console.log("requestData: " + this._config.entities.length);

        const entities: string[] = [];
        for (const entity of this._config.entities) {
            entities.push(entity.entity);
        }

        //console.log(this._range);
        this._range.end = new Date();

        const request = {
            type: "history/history_during_period",
            start_time: this._range.start.toISOString(),
            end_time: this._range.end.toISOString(),
            minimal_response: true,
            no_attributes: true,
            entity_ids: entities
        };
        console.log(request);

        this._hass.callWS(request).then(this.dataResponse.bind(this), this.loaderFailed.bind(this));
    }

    resize() {
        console.log("resize()")
        const w = this._card.clientWidth;
        console.log("width: " + w)
        this._chart.resize();
    }

    getCardSize() {
        return 3;
    }

    // configuration defaults
    static getStubConfig() {
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

    private sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private dataResponse(result) {
        //console.log("dataResponse >>")
        console.log(result)

        let thisCard: PowerGraph = this;

        type DataItem = {
            lu: number;
            s: number;
        }

        let legends: string[] = [];
        this._series = [];

        for (let entityId in result) {
            let entity: EntityConfig = this._config.getEntityById(entityId);
            legends.push(entity.name || entity.entity)
            const arr: DataItem[] = result[entityId];
            //console.log(a);

            let data: number[][] = [];
            for (let i = 1; i < arr.length; i++) {
                const time: number = Math.round(arr[i].lu * 1000);
                data.push([time, arr[i].s]);
            }

            const line = {
                name: entity.name || entity.entity,
                type: 'line',
                smooth: false,
                symbol: 'none',
                //areaStyle: {},
                data: data
            };
            if (this._config.shadow || entity.shadow) {
                Object.assign(line, {
                    lineStyle: {
                        width: 3,
                        shadowColor: 'rgba(0,0,0,0.3)',
                        shadowBlur: 10,
                        shadowOffsetY: 8
                    }
                });
            }
            //console.log(line);
            this._series.push(line)
        }

        let config: GraphConfig = this._config;
        this._chart.setOption({
            legend: {
                data: legends,
                formatter: function (name) {
                    const entity: EntityConfig = config.getEntityByName(name);
                    const arr: DataItem[] = result[entity.entity];
                    const lastItem: DataItem = arr[arr.length - 1];
                    return name + " (" + lastItem.s + " " + thisCard.getUnitOfMeasurement(entity.entity) + ")";
                }
            },
            xAxis: {
                type: 'time',
                boundaryGap: false
            },
            series: this._series
        });

        if (isNumber(this._config.autorefresh) && this._tid == 0) {
            //console.log("setInterval");
            this._tid = setInterval(this.requestData.bind(this), +this._config.autorefresh * 1000);
        }
    }

    private loaderFailed(error) {
        console.log("Database request failure");
        console.log(error);
    }

    private clearRefreshInterval() {
        if (this._tid != 0) {
            console.log("clearInterval");
            clearTimeout(this._tid);
            this._tid = 0;
        }
    }

    private getDeviceClass(entityId) {
        return this._hass.states[entityId]?.attributes?.device_class;
    }

    private getUnitOfMeasurement(entityId) {
        return this._hass.states[entityId]?.attributes?.unit_of_measurement;
    }

    private getStateClass(entityId) {
        return this._hass.states[entityId]?.attributes?.state_class;
    }

    connectedCallback() {
        console.log("connectedCallback");
        this.createChart();
        this._resizeObserver.observe(this._card);
    }
    disconnectedCallback() {
        console.log("disconnectedCallback");
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
