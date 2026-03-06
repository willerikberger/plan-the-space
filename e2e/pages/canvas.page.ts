import type { Page, Locator } from "@playwright/test";
import { SidebarComponent } from "../components/sidebar.component";
import { ToolbarComponent } from "../components/toolbar.component";
import { CalibrationComponent } from "../components/calibration.component";
import { ShapePanelComponent } from "../components/shape-panel.component";
import { LinePanelComponent } from "../components/line-panel.component";
import { ImagePanelComponent } from "../components/image-panel.component";
import { ObjectListComponent } from "../components/object-list.component";
import { StoragePanelComponent } from "../components/storage-panel.component";
import { CleanupComponent } from "../components/cleanup.component";
import { CanvasInteraction } from "../components/canvas-interaction";
import { getStoreState, waitForCanvasReady } from "../fixtures/helpers";

export class CanvasPage {
  readonly page: Page;
  readonly canvas: Locator;
  readonly statusBar: Locator;

  readonly sidebar: SidebarComponent;
  readonly toolbar: ToolbarComponent;
  readonly calibration: CalibrationComponent;
  readonly shapes: ShapePanelComponent;
  readonly lines: LinePanelComponent;
  readonly images: ImagePanelComponent;
  readonly objectList: ObjectListComponent;
  readonly storage: StoragePanelComponent;
  readonly cleanup: CleanupComponent;
  readonly canvasInteraction: CanvasInteraction;

  constructor(page: Page) {
    this.page = page;
    this.canvas = page.locator('canvas[aria-label="Floor plan design canvas"]');
    this.statusBar = page.locator('[data-testid="status-bar"]');

    this.sidebar = new SidebarComponent(page);
    this.toolbar = new ToolbarComponent(page);
    this.calibration = new CalibrationComponent(page);
    this.shapes = new ShapePanelComponent(page);
    this.lines = new LinePanelComponent(page);
    this.images = new ImagePanelComponent(page);
    this.objectList = new ObjectListComponent(page);
    this.storage = new StoragePanelComponent(page);
    this.cleanup = new CleanupComponent(page);
    this.canvasInteraction = new CanvasInteraction(page);
  }

  async getState() {
    return getStoreState(this.page);
  }

  async goHome() {
    await this.toolbar.goHome();
  }

  async waitForReady() {
    await waitForCanvasReady(this.page);
  }
}
