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
import { Pair, TimeRange } from './GraphData'
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
    onGraphCreated(): void;
    getConfig(): PowerGraphConfig;
    getUnitOfMeasurement(entityId: string): string;
    getTimeRange(): TimeRange;
    setTimeRange(timeRange: TimeRange): void;
    getClientArea(): Pair<number, number>;
    isMobile(): boolean;
    scrollGraph(graph: Graph, startEnd: Pair<number, number>): void;
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
    private _isMobile: boolean;

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

        const userAgent: string = navigator.userAgent || navigator.vendor;
        this._isMobile = (
            /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(userAgent) ||
            /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(userAgent.substr(0, 4))
        );

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
            .chart-container {
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

    onGraphCreated(): void {
        const charts: any[] = [];
        // let allCreated: boolean = this._graphs.length > 0;
        for (const graph of this._graphs) {
            const chart: echarts.EChartsType = graph.getChart();
            if (chart != null) {
                charts.push(chart);
            } else {
                return;
            }
            // if (!graph.isCreated()) {
            //     allCreated = false;
            //     break;
            // }
        }
        // console.log("PowerGraph::connect: " + charts.length);
        // echarts.connect(charts);
        // if (allCreated) {
        //     echarts.connect([chart1, chart2]);
        // }
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

    isMobile(): boolean {
        return this._isMobile;
    }

    scrollGraph(touchedGraph: Graph, startEnd: Pair<number, number>): void {
        for (const graph of this._graphs) {
            if (graph != touchedGraph) {
                graph.scrollGraph(startEnd);
            }
        }
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
