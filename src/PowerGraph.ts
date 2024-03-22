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

import { Graph } from './Graph'
import { PowerGraphConfig, GraphConfig, EntityConfig } from './GraphConfig';
import { Pair, TimeRange, GraphData, getCurrentDataTimeRange } from './GraphData'
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

export interface IPowerGraph {
    getConfig(): PowerGraphConfig;
    getUnitOfMeasurement(entityId: string): string;
    getTimeRange(): TimeRange;
    setTimeRange(timeRange: TimeRange): void;
    getClientArea(): Pair<number, number>;
}

class PowerGraph extends HTMLElement implements IPowerGraph {
    private _config: PowerGraphConfig = null;
    private _hass: HomeAssistant;
    private _elements = { card: Element, style: Element };
    private _mainContener: HTMLElement;
    private _graphs: Graph[];
    private _infoBox: HTMLElement;
    private _range: TimeRange;
    private _resizeObserver;

    constructor() {
        super();

        this._resizeObserver = new ResizeObserver(entries => { this.resize(); });
    }

    public setConfig(config: GraphConfig): void {
        // console.error("setConfig");
        this._config = new PowerGraphConfig(config);
        this._range = new TimeRange(DateTime.local().minus({ hours: this._config.timRangeInHours }), DateTime.local());
        this._graphs = [];
        for (const graphConfig of this._config.graphs) {
            this._graphs.push(new Graph(this, graphConfig));
        }
        this._config.validate();
        this.createContent();
    }

    set hass(hass: HomeAssistant) {
        // console.log(hass);
        this._hass = hass;
        for (const graph of this._graphs) {
            graph.setHass(hass);
        }
    }

    getConfig(): PowerGraphConfig {
        return this._config;
    }

    private createContent(): void {
        // console.log("PowerGraph::createContent");

        const thisGraph: PowerGraph = this;

        this._mainContener = document.createElement("div");
        this._mainContener.setAttribute("id", "main-container");

        for (const graph of this._graphs) {
            graph.createContent(this._mainContener);
        }

        // this._infoBox = document.createElement("div");
        // this._infoBox.setAttribute("id", "infoBox");

        var _style: Element = document.createElement("style");
        _style.textContent = `
            #chart-container {
                width: 100%;
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
        this.shadowRoot!.append(_style, this._mainContener/*, this._infoBox*/);
    }

    getTimeRange(): TimeRange {
        return this._range;
    }

    setTimeRange(timeRange: TimeRange): void {
        this._range = timeRange;
    }

    resize(): void {
        // console.log("PowerGraph::resize");
        for (const graph of this._graphs) {
            graph.resize();
        }
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

    getUnitOfMeasurement(entityId: string): string {
        return this._hass.states[entityId]?.attributes?.unit_of_measurement;
    }

    private getStateClass(entityId: string): string {
        return this._hass.states[entityId]?.attributes?.state_class;
    }

    getClientArea(): Pair<number, number> {
        return new Pair<number, number>(this._mainContener.clientWidth, this._mainContener.clientHeight);
    }

    connectedCallback(): void {
        //console.log("connectedCallback");
        this._resizeObserver.observe(this._mainContener);
    }
    disconnectedCallback(): void {
        //console.log("disconnectedCallback");
        this._resizeObserver.unobserve(this._mainContener);
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
