import { CanvasRenderer } from 'echarts/renderers';

export interface EntityConfig {
    entity: string;
    name: string;
    shadow: boolean;
};

export class GraphConfig {
    title: string;
    autorefresh: string;
    shadow: boolean;
    entities: EntityConfig[];
    timRangeInHours: number;
    start: Date;
    animation: boolean;
    showTooltip: boolean;
    sampling: boolean;
    fillAread: boolean;
    renderer: 'canvas' | 'svg';
    showInfo: boolean;
    logOptions: boolean;
    qualities: number[]

    constructor(obj) {
        this.animation = true;
        this.renderer = 'canvas';
        this.sampling = false;
        this.timRangeInHours = 2;
        obj && Object.assign(this, obj);
    }

    public validate() {
        try {
            if (this.start === undefined) {
                throw new Error();
            }
            this.start = new Date(this.start);
        } catch (err: any) {
            this.start = new Date(new Date());
            this.start.setHours(this.start.getHours() - 2);
        }
        //console.log("start: " + this.start.toString());
        if (!this.entities) {
            throw new Error('Please define an entity!');
        }
    }

    public getEntityById(entityId: string): EntityConfig {
        for (const entity of this.entities) {
            if (entity.entity == entityId) {
                return entity;
            }
        }
        throw Error("EntityId not found: " + entityId);
    }

    public getEntityByName(name: string): EntityConfig {
        for (const entity of this.entities) {
            if (entity.name == name) {
                return entity;
            }
        }
        throw Error("Entity name not found: " + name);
    }

    public getEntityConfigIndex(entityConfig: EntityConfig): number {
        let index = 0;
        for (const entity of this.entities) {
            if (entity === entityConfig) {
                return index;
            }
            ++index;
        }
        throw Error("Entity config not found: " + entityConfig.entity);
    }
}
