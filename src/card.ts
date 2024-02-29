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

    constructor() {
        super();
        this.createContent();
    }

    setConfig(config) {
        this._config = config;

        if (!this._config.entities) {
            throw new Error('Please define an entity!');
        }
        /*        if (!this._config.entity) {
                    throw new Error('Please define an entity!');
                }*/
    }

    set hass(hass) {
        this._hass = hass;
    }

    // accessors
    getEntityID() {
        return this._config.entity;
    }

    getState() {
        return this._hass.states[this.getEntityID()];
    }

    getAttributes() {
        return this.getState().attributes
    }

    getName() {
        const friendlyName = this.getAttributes().friendly_name;
        return friendlyName ? friendlyName : this.getEntityID();
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
            }
        `

        this.attachShadow({ mode: "open" });
        this.shadowRoot!.append(_style, this._card);

        this.sleep(100).then(() => {
            console.log('now attach!');
            this.myAttach();
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

    myAttach() {
        let entities: string[] = [];
        for (let id in this._config.entities) {
            let entity = this._config.entities[id]
            console.log(entity);
            entities.push(entity.entity);
        }

        const request = {
            type: "history/history_during_period",
            start_time: this.formatDate(this.subHours(new Date(), 4)),
            end_time: this.formatDate(new Date()),
            minimal_response: true,
            no_attributes: true,
            entity_ids: entities
        };
        console.log(request);
        this._hass.callWS(request).then(this.loaderCallbackWS.bind(this), this.loaderFailed.bind(this));
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

    loaderCallbackWS(result) {
        console.log("loaderCallbackWS")
        console.log(result)

        type Post = {
            last_changed: number;
            state: any;
            entity_id: string;
        }
        type TSerie = {
            name: string;
            type: string;
            smooth: boolean;
            symbol: string;
            data: any;
        }

        let legends: string[] = [];
        let series: TSerie[] = [];

        for (let entity in result) {
            console.log(entity);
            legends.push(entity)
            const a = result[entity];
            console.log(a);

            let data: number[][] = [];
            for (let i = 1; i < a.length; i++) {
                data.push([a[i].lu * 1000, a[i].s]);
            }

            series.push({
                name: entity,
                type: 'line',
                smooth: false,
                symbol: 'none',
                data: data
            })
        }

        this._chart = echarts.init(this._card);
        this._chart.setOption({
            tooltip: {
                trigger: 'axis',
                position: function (pt) {
                    return [pt[0], '10%'];
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
            legend: {
                data: legends
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
            ],
            series: series
        });
        this._chart.resize();
    }

    loaderFailed(error) {
        console.log("Database request failure");
        console.log(error);
    }
}

customElements.define('power-graph', ToggleCardWithShadowDom);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "power-graph",
    name: "Power Graph Card",
    description: "An interactive history viewer card"
});