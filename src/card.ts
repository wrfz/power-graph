
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
    private _config: GraphConfig;
    private _hass;
    private _elements = { card: Element, style: Element };
    private _card: HTMLElement;
    private _chart: echarts.EChartsType;
    private _tid: number = 0;
    private _series: any[] = [];

    constructor() {
        super();
        this.createContent();
    }

    setConfig(config: GraphConfig) {
        //console.log("setConfig");
        this._config = new GraphConfig(config);
        this._config.validate();

        this.clearRefreshInterval();
    }

    set hass(hass) {
        //console.log("hass");
        this._hass = hass;
    }

    private createContent() {
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

    private formatDate(date: Date): string {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');;
        const minutes = date.getMinutes().toString().padStart(2, '0');;
        const seconds = date.getSeconds().toString().padStart(2, '0');;
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
    }

    private subHours(date, hours) {
        const hoursToAdd = hours * 60 * 60 * 1000;
        date.setTime(date.getTime() - hoursToAdd);
        return date;
    }

    private requestData() {
        //console.log("requestData: " + this._config.entities.length);

        let entities: string[] = [];
        for (const entity of this._config.entities) {
            entities.push(entity.entity);
        }

        const request = {
            type: "history/history_during_period",
            start_time: this.formatDate(this.subHours(new Date(), 2 * 24)),
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

    private sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private dataResponse(result) {
        //console.log("dataResponse >>")
        //console.log(result)

        // type Post = {
        //     last_changed: number;
        //     state: any;
        //     entity_id: string;
        // }

        let legends: string[] = [];
        this._series = [];

        for (let entityId in result) {
            let entity: EntityConfig = this._config.getEntityById(entityId);
            legends.push(entity.name || entity.entity)
            const arr = result[entityId];
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

        this._chart.setOption({
            legend: {
                data: legends
            },
            xAxis: {
                type: 'time',
                boundaryGap: false
            },
            series: this._series
        });

        if (this.isNumber(this._config.autorefresh) && this._tid == 0) {
            //console.log("setInterval");
            this._tid = setInterval(this.requestData.bind(this), +this._config.autorefresh * 1000);
        }
    }

    private loaderFailed(error) {
        console.log("Database request failure");
        console.log(error);
    }

    private isNumber(value?: string | number): boolean {
        return (value != null && value !== '' && !isNaN(Number(value.toString())));
    }

    private clearRefreshInterval() {
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
