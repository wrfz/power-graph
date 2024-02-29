import * as echarts from 'echarts/core';

// Import bar charts, all suffixed with Chart
import { BarChart } from 'echarts/charts';

import {
    TitleComponent,
    TooltipComponent,
    GridComponent,
    DatasetComponent,
    TransformComponent
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
    TooltipComponent,
    GridComponent,
    DatasetComponent,
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

    // private properties
    _config;
    _hass;
    _elements = { card: Element, style: Element };
    _card: HTMLElement;

    // lifecycle
    constructor() {
        super();
        this.doCard();
        this.doStyle();
        this.doAttach();
    }

    setConfig(config) {
        this._config = config;
        this.doCheckConfig();
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

    // jobs
    doCheckConfig() {
        if (!this._config.entity) {
            throw new Error('Please define an entity!');
        }
    }

    doCard() {
        console.log("doCard() >>")
        this._card = document.createElement("div");
        this._card.setAttribute("id", "chart-container");
    }

    doStyle() {
        console.log("doStyle() >>")
    }

    doAttach() {
        var _style:Element = document.createElement("style");
        _style.textContent = `
            #chart-container {
                position: relative;
                height: 100vh;
                overflow: hidden;
            }
        `

        console.log("doAttach() >>")
        this.attachShadow({ mode: "open" });
        this.shadowRoot!.append(_style, this._card);

        this.sleep(100).then(() => {
            console.log('now attach!');
            this.myAttach();
        });
    }

    myAttach() {
        var myChart = echarts.init(this._card);
        myChart.setOption({
            title: {
                text: 'ECharts Getting Started Example'
            },
            tooltip: {},
            xAxis: {
                data: ['shirt', 'cardigan', 'chiffon', 'pants', 'heels', 'socks']
            },
            yAxis: {},
            series: [
                {
                    name: 'sales',
                    type: 'bar',
                    data: [5, 20, 36, 10, 10, 20]
                }
            ]
        });
        myChart.resize();
    }

    resize() {
        console.log("resize() >>")
        const w = this._card.clientWidth;
        console.log("width: " + w)
        console.log("resize() <<")
    }

    doToggle() {
        this._hass.callService('input_boolean', 'toggle', {
            entity_id: this.getEntityID()
        });
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

}

customElements.define('toggle-card-with-shadow-dom', ToggleCardWithShadowDom);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "toggle-card-with-shadow-dom",
    name: "Vanilla Js Toggle With Shadow DOM",
    description: "Turn an entity on and off"
});