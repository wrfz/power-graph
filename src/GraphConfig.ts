import { CanvasRenderer } from 'echarts/renderers';

export interface EntityConfig {
    entity: string;
    name: string;
    shadow: boolean;
    color: string;
    fillColor: string;
};

export class GraphConfig {
    type: string;
    title: string;
    autorefresh: number;
    shadow: boolean;
    entities: EntityConfig[];
    timRangeInHours: number = 2;
    animation: boolean = true;
    showTooltip: boolean = false;
    sampling: boolean = false;
    fillAread: boolean = false;
    renderer: 'canvas' | 'svg' = 'canvas';
    showInfo: boolean = false;
    logOptions: boolean = false;
    qualities: number[]

    constructor(obj: any) {
        // for (const key in obj) {
        //     if (!this.hasOwnProperty(key)) {
        //         throw new Error('Unsupported key: ' + key);
        //     }
        // }

        obj && Object.assign(this, obj);
    }

    public validate(): void {
        //console.log("start: " + this.start.toString());
        if (!this.entities) {
            throw new Error('Please define an entity!');
        }
    }

    getEntities(): EntityConfig[] {
        return this.entities;
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
