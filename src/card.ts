
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


import * as echarts from 'echarts/core';

//import "moment.min";

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


class ToggleCardWithShadowDom extends HTMLElement {
    _config;
    _hass;
    _elements = { card: Element, style: Element };
    _card: HTMLElement;
    _chart: echarts.EChartsType;
    _tid: number = 0;
    _series: any[] = [];

    constructor() {
        super();
        this.createContent();
    }

    setConfig(config) {
        //console.log("setConfig");
        this._config = config;

        if (!this._config.entities) {
            throw new Error('Please define an entity!');
        }
        this.clearRefreshInterval();
    }

    set hass(hass) {
        //console.log("hass");
        this._hass = hass;
    }

    createContent() {
        this._card = document.createElement("div");
        this._card.setAttribute("id", "chart-container");

        var _style: Element = document.createElement("style");
        _style.textContent = `
            #chart-container {
                position: relative;
                height: 90vh;
                overflow: hidden;
            }`

        this.attachShadow({ mode: "open" });
        this.shadowRoot!.append(_style, this._card);



        this.sleep(100).then(() => {
            //console.log('create chart object');

            this._chart = echarts.init(this._card);
            let options = {
                tooltip: {
                    trigger: 'axis',
                    triggerOn: 'click',
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
                    }
                },
                toolbox: {
                    feature: {
                        dataZoom: {
                            yAxisIndex: 'none'
                        },
                        restore: {},
                        saveAsImage: {}
                    }
                },
                xAxis: {
                    type: 'time',
                    boundaryGap: false
                },
                yAxis: {
                    type: 'value'
                },
                dataZoom: [
                    {
                        type: 'inside',
                        start: 70,
                        end: 100
                    },
                    {
                        start: 70,
                        end: 100
                    }
                ]
            };
            if (this._config.title) {
                Array.prototype.concat.call(options, { title: this._config.title })
            }
            this._chart.setOption(options);
            this._chart.resize();

            this.requestData();
        });
    }

    formatDate(date: Date): string {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');;
        const minutes = date.getMinutes().toString().padStart(2, '0');;
        const seconds = date.getSeconds().toString().padStart(2, '0');;
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
    }

    subHours(date, hours) {
        const hoursToAdd = hours * 60 * 60 * 1000;
        date.setTime(date.getTime() - hoursToAdd);
        return date;
    }

    requestData() {
        //console.log("requestData >>");

        let entities: string[] = [];
        for (let id in this._config.entities) {
            let entity = this._config.entities[id]
            //console.log(entity);
            entities.push(entity.entity);
        }

        const request = {
            type: "history/history_during_period",
            start_time: this.formatDate(this.subHours(new Date(), 24)),
            end_time: this.formatDate(new Date()),
            minimal_response: true,
            no_attributes: true,
            entity_ids: entities
        };
        //console.log(request);

        this._hass.callWS(request).then(this.dataResponse.bind(this), this.loaderFailed.bind(this));
    }

    resize() {
        console.log("resize() >>")
        const w = this._card.clientWidth;
        console.log("width: " + w)
        console.log("resize() <<")
    }

    getCardSize() {
        return 3;
    }

    // configuration defaults
    static getStubConfig() {
        return { entity: "input_boolean.tcwsd" }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    dataResponse(result) {
        //console.log("dataResponse >>")
        //console.log(result)

        type Post = {
            last_changed: number;
            state: any;
            entity_id: string;
        }

        let legends: string[] = [];
        let xAxisData: Set<number> = new Set<number>();
        this._series = [];

        for (let entityId in result) {
            // console.log(entity);
            legends.push(entityId)
            const arr = result[entityId];
            //console.log(a);

            let data: number[][] = [];
            for (let i = 1; i < arr.length; i++) {
                let time = Math.round(arr[i].lu * 1000);
                data.push([time, arr[i].s]);
                xAxisData.add(time);
            }

            this._series.push({
                name: entityId,
                type: 'line',
                smooth: false,
                symbol: 'none',
                lineStyle: {
                    width: 3,
                    shadowColor: 'rgba(0,0,0,0.3)',
                    shadowBlur: 10,
                    shadowOffsetY: 8
                },
                data: data
            })
        }

        this._chart.setOption({
            legend: {
                data: legends
            },
            xAxis: {
                type: 'time',
                boundaryGap: false,
                data: xAxisData
            },
            series: this._series
        });

        if (this.isNumber(this._config.autorefresh) && this._tid == 0) {
            //console.log("setInterval");
            this._tid = setInterval(this.requestData.bind(this), +this._config.autorefresh * 1000);
        }
    }

    loaderFailed(error) {
        console.log("Database request failure");
        console.log(error);
    }

    isNumber(value?: string | number): boolean {
        return (value != null && value !== '' && !isNaN(Number(value.toString())));
    }

    clearRefreshInterval() {
        if (this._tid != 0) {
            console.log("clearInterval");
            clearTimeout(this._tid);
            this._tid = 0;
        }
    }
}

customElements.define('power-graph', ToggleCardWithShadowDom);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "power-graph",
    name: "Power Graph Card",
    description: "An interactive history viewer card"
});
