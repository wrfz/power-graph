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

export class PowerGraphEditor extends LitElement {
    private _config: any;
    private _hass: any;

    static get properties() {
        console.log("properties");
        return {
            hass: {},
            _config: {},
        };
    }

    // setConfig works the same way as for the card itself
    setConfig(config) {
        console.log("setConfig: " + config);
        this._config = config;
    }

    set hass(hass) {
        console.log("hass: " + hass);
        //console.log("hass");
        this._hass = hass;
    }

    // This function is called when the input element of the editor loses focus
    entityChanged(ev) {
        console.log("entity changes");

        // We make a copy of the current config so we don't accidentally overwrite anything too early
        const _config = Object.assign({}, this._config);
        // Then we update the entity value with what we just got from the input field
        _config.entity = ev.target.value;
        // And finally write back the updated configuration all at once
        this._config = _config;

        // A config-changed event will tell lovelace we have made changed to the configuration
        // this make sure the changes are saved correctly later and will update the preview
        const event = new CustomEvent("config-changed", {
            detail: { config: _config },
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);
    }

    render() {
        if (!this._hass || !this._config) {
            return html``;
        }

        console.log("render2");

        return html`
      <ha-form
      .hass=${this._hass}
      .data=${this._config}
      .schema=${[
                { name: "entity", selector: { entity: { domain: "sensor" } } },
                {
                    name: "show_bars", selector: {
                        select: {
                            multiple: true, mode: "list", options: [
                                { label: "Label 1", value: "bar1" },
                                { label: "Label 2", value: "bar2" },
                                { label: "Another Label", value: "bar3" },
                                { label: "What now?", value: "bar4" },
                            ]
                        }
                    }
                }
            ]}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      >
      </ha-form>

    `;
    }

    private _computeLabel(schema): string {
        console.log("_computeLabel: " + schema.name);

        var labelMap = {
            field1: "New Label 1",
            field2: "New Label 2",
            entity: "EntityId",
            show_bars: "bla bla"
        }
        return labelMap[schema.name];
    }

    private _valueChanged(ev): void {
        console.log("_valueChanged");

        if (!this._config || !this._hass) {
            return;
        }
        const _config = Object.assign({}, this._config);
        _config.entity = ev.detail.value.entity;
        _config.battery_sensor = ev.detail.value.battery_sensor;
        _config.show_bars = ev.detail.value.show_bars;

        this._config = _config;

        const event = new CustomEvent("config-changed", {
            detail: { config: _config },
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);
    }
}

customElements.define("power-graph-editor", PowerGraphEditor);