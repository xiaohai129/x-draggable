import { debounce } from 'lodash';

type DraggableOptions = {
  // 拖动ID isAllowIn: true 必传
  dragId?: string;
  // 是否拖动子元素
  isChildren?: boolean;
  // 是否允许拖出
  isAllowOut?: boolean;
  // 是否允许拖入
  isAllowIn?: boolean;
  // 是否允许排序
  isSort?: boolean;
  // 改变大小ID
  resizeId?: string;
  // 允许拖动改变大小的方向
  direction?: '' | 'right' | 'left' | 'top' | 'bottom';
};
type PositionItem = {
  top: number;
  left: number;
  width: number;
  height: number;
  el?: HTMLElement;
};

// 拖拽池 允许拖动的元素信息
const draggablePools: Record<string, PositionItem> = {};
// 当前操作对象
let _this: XDraggable;

export default class XDraggable {
  private el: HTMLElement;
  private options: DraggableOptions = {
    isChildren: false,
    isAllowIn: false,
    isAllowOut: false,
    isSort: false,
  };
  // 当前操作元素
  private $current: HTMLElement | null = null;
  // 遮罩元素
  private $mask: HTMLElement | null = null;
  // 元素信息
  private info = {
    currentTop: 0,
    currentLeft: 0,
    currentWidth: 0,
    currentHeight: 0,
    offsetTop: 0,
    offsetLeft: 0,
    parentTop: 0,
    parentLeft: 0,
    parentWidth: 0,
    parentHeight: 0,
  };
  // 子元素信息
  private childrenInfos: Record<string, PositionItem> = {};
  // 用户事件函数
  private eventFns: Record<string, (e: any) => void> = {};
  // 用户选择的索引
  private dragIndex = -1;
  // 现在是否改变大小
  private isResize = false;

  constructor(el: HTMLElement, options: DraggableOptions) {
    this.el = el;
    this.options = Object.assign(this.options, options);
    this.init();
  }
  // 初始化
  private init() {
    _this = this;
    this.initDragPoolInfo();
    this.initChildren();
    this.insertStyle();
    this.initEvents();
    this.initDragHandleElement();
  }
  // 决定是否使用子元素模式
  private initChildren() {
    if (this.options.isChildren) {
      const children = this.el.children;
      if (children.length <= 0) {
        console.warn('isChildren属性设置无效，无可用子元素');
        this.options.isChildren = false;
        this.el.classList.add('x-draggable-item');
      } else {
        for (let i = 0; i < children.length; i++) {
          const child = children[i] as HTMLElement;
          child.setAttribute('drag-index', i + '');
          child.style.order = i + '';
          child.classList.add('x-draggable-item');
        }
        if (this.options.isSort) {
          this.updateChildrenInfo(children as any);
        }
        this.el.classList.add('x-draggable-wrap');
      }
    }
  }
  // 初始化用户事件
  private initEvents() {
    this.el.addEventListener('mousedown', (e) => {
      _this = this;
      this.handleUserMove(e);
    });
    this.initMaskElement();
  }
  // 初始化遮罩元素
  private initMaskElement() {
    const $mask = document.getElementById('x-draggable-mask');
    if ($mask) {
      this.$mask = $mask;
      return;
    }
    this.$mask = document.createElement('div');
    this.$mask.setAttribute('id', 'x-draggable-mask');
    this.$mask.addEventListener('mousemove', (e) => {
      _this.handleUserMove(e);
    });
    this.$mask.addEventListener('mouseup', (e) => {
      _this.handleUserMove(e);
    });
    document.body.appendChild(this.$mask);
  }
  // 初始化池中信息 方便后续查询
  private initDragPoolInfo() {
    if (!this.options.isAllowIn) {
      return;
    }
    if (!this.options.dragId) {
      console.warn('dragId无效，isAllowIn设置失败');
      this.options.isAllowIn = false;
      return;
    }
    const info = this.updateElementInfo();
    draggablePools[this.options.dragId] = {
      top: info.parentTop,
      left: info.parentLeft,
      width: info.parentWidth,
      height: info.parentHeight,
    };
  }
  // 插入拖动大小控制元素
  private initDragHandleElement() {
    if (!this.options.direction) {
      return;
    }

    const $handle = document.createElement('div');
    $handle.classList.add('x-draggable-handle');
    $handle.addEventListener('mousedown', (e) => {
      this.isResize = true;
    });
    this.el.classList.add('x-draggable-size-wrap', this.options.direction);
    this.el.appendChild($handle);
  }

  // 用户移动事件统一处理
  private handleUserMove(e: MouseEvent) {
    if (this.isResize) {
      this.handleResize(e);
    } else {
      this.handleDraggable(e);
    }
  }
  // 处理改变大小
  private handleResize(e: MouseEvent) {    
    if (e.type === 'mouseup') {
      this.computeElementSize(e, true);
      this.$mask!.style.display = 'none';
      this.$mask!.className = '';
      this.isResize = false;
    } else if (e.type === 'mousemove') {
      this.computeElementSize(e);
    } else if (e.type === 'mousedown') {
      if (!this.$mask) {
        return;
      }
      this.$mask.style.display = 'block';
      this.$mask.className = this.options.direction!;
      this.$current = this.el;
      this.isResize = true;

      this.updateElementInfo(e);
    }
  }
  // 处理拖拽
  private handleDraggable(e: MouseEvent) {
    // 拖动元素
    if (e.type === 'mousedown') {
      let target = this.el;
      if (this.options.isChildren) {
        target = e.target as HTMLElement;
      }
      // 记录点击时信息
      this.$current = target.cloneNode(true) as HTMLElement;
      this.$current.classList.add('x-draggable-clone');
      this.$mask!.style.display = 'block';
      if (this.options.isSort) {
        this.dragIndex = parseInt(this.$current.style.order || '-1');
      } else {
        this.dragIndex = parseInt(this.$current.getAttribute('drag-index') || '-1');
      }
      document.body.appendChild(this.$current);
      this.updateElementInfo(e);
    }
    const position = this.computeElementPosition(e);

    this.reanderCurrentStyle({
      top: position.top + 'px',
      left: position.left + 'px',
    });
    // 抬起鼠标 判断是否重合
    if (e.type === 'mouseup') {
      this.$mask!.style.display = 'none';
      this.$mask!.className = '';
      if (this.options.isAllowOut) {
        const dragId = this.checkPoolsCoincide({
          top: e.pageY,
          left: e.pageX,
          width: 0,
          height: 0,
        });
        if (dragId && this.eventFns.drag) {
          this.eventFns.drag({
            id: dragId,
            index: this.dragIndex,
          });
        }
      }
      document.body.removeChild(this.$current!);
    } else if (e.type === 'mousemove') {
      this.checkChildrenSort({
        ...position,
        width: 0,
        height: 0,
      });
    }
  }
  // 外部事件监听
  public on(eventName: 'drag', fn: (e: any) => void) {
    this.eventFns[eventName] = fn;
  }
  // 检查池中元素位置 判断是否与其他有重合
  private checkPoolsCoincide(info: PositionItem) {
    for (const key in draggablePools) {
      const pool = draggablePools[key];
      if (
        pool.top < info.top &&
        pool.top + pool.height > info.top &&
        pool.left < info.left &&
        pool.left + pool.width > info.left
      ) {
        return key;
      }
    }
    return '';
  }
  // 检查子元素排序
  private checkChildrenSort = debounce(
    (info: PositionItem) => {
      let index = -1;
      if (this.childrenInfos[this.dragIndex - 1] && this.childrenInfos[this.dragIndex - 1].top >= info.top - 10) {
        // 向上
        index = this.dragIndex - 1;
      } else if (
        this.childrenInfos[this.dragIndex + 1] &&
        this.childrenInfos[this.dragIndex + 1].top <= info.top + 10
      ) {
        // 向下
        index = this.dragIndex + 1;
      }

      // 更改排序信息
      if (index >= 0 && this.childrenInfos[this.dragIndex]) {
        this.childrenInfos[this.dragIndex].el!.style.order = index + '';
        this.childrenInfos[index].el!.style.order = this.dragIndex + '';
        const temp = this.childrenInfos[this.dragIndex];
        this.childrenInfos[this.dragIndex] = this.childrenInfos[index];
        this.childrenInfos[index] = temp;
        this.dragIndex = index;
        this.updateChildrenInfo();
      }
    },
    200,
    {
      leading: true,
    }
  );
  // 更新元素信息
  private updateElementInfo(e?: MouseEvent) {
    let info = {
      currentTop: 0,
      currentLeft: 0,
      offsetTop: 0,
      offsetLeft: 0,
      currentWidth: 0,
      currentHeight: 0,
      parentTop: this.el.offsetTop,
      parentLeft: this.el.offsetLeft,
      parentWidth: this.el.offsetWidth,
      parentHeight: this.el.offsetHeight,
    };
    if (e) {
      info = Object.assign(info, {
        offsetTop: e.offsetY,
        offsetLeft: e.offsetX,
      });
    }
    if (this.$current) {
      info = Object.assign(info, {
        currentTop: this.$current.offsetTop,
        currentLeft: this.$current.offsetLeft,
        currentWidth: this.$current.offsetWidth,
        currentHeight: this.$current.offsetHeight,
      });
    }
    this.info = info;
    
    return info;
  }
  // 更新子元素信息
  private updateChildrenInfo(children?: HTMLElement[]) {
    if (!children) {
      children = this.el.children as any;
    }
    const childrenInfos: Record<string, PositionItem> = {};
    for (let i = 0; i < children!.length; i++) {
      const child = children![i];
      // 根据order排序
      const index = child.style.order;
      childrenInfos[index] = {
        top: child.offsetTop,
        left: child.offsetLeft,
        width: child.offsetWidth,
        height: child.offsetHeight,
        el: child,
      };
    }
    this.childrenInfos = childrenInfos;
  }
  // 计算元素位置
  private computeElementPosition(e: MouseEvent) {
    let top = e.pageY - this.info.offsetTop;
    let left = e.pageX - this.info.offsetLeft;
    if (!this.options.isAllowOut && this.options.isChildren) {
      // 矩形判断
      const maxTop = this.info.parentTop + this.info.parentHeight - this.info.currentHeight;
      if (top < this.info.parentTop) {
        top = this.info.parentTop;
      } else if (top > maxTop) {
        top = maxTop;
      }
      const maxLeft = this.info.parentLeft + this.info.parentWidth - this.info.currentWidth;
      if (left < this.info.parentLeft) {
        left = this.info.parentLeft;
      } else if (left > maxLeft) {
        left = maxLeft;
      }
    }
    return {
      top,
      left,
    };
  }
  // 计算移动后大小
  private computeElementSize(e: MouseEvent, isSave = false) {
    const point = {
      x: e.pageX,
      y: e.pageY,
    };
    let size = 0;
    const direction = this.options.direction;
    if (direction === 'right') {
      const x = point.x - (this.info.currentLeft + this.info.parentWidth);
      size = this.info.parentWidth + x;
    } else if (direction === 'left') {
      const x = this.info.currentLeft - point.x;
      size = this.info.parentWidth + x;
    } else if (direction === 'top') {
      const y = this.info.currentTop - point.y;
      size = this.info.parentHeight + y;
    } else if (direction === 'bottom') {
      const y = point.y - (this.info.currentTop + this.info.parentHeight);
      size = this.info.parentHeight + y;
    }
    this.setElementSize(size);
    if (isSave) {
      window.localStorage.setItem('drag-' + this.options.resizeId + '-size', size + '');
    }
  }
  // 设置当前元素大小
  private setElementSize(size: number) {
    const direction = this.options.direction;
    if (direction === 'left' || direction === 'right') {
      this.el.style.width = size + 'px';
    } else if (direction === 'top' || direction === 'bottom') {
      this.el.style.height = size + 'px';
    }
  }
  // 渲染当前元素
  private reanderCurrentStyle(styles: Partial<CSSStyleDeclaration>) {
    for (const key in styles) {
      (this.$current!.style as any)[key] = (styles as any)[key];
    }
  }
  // 创建随机字符串
  private createRandomStr() {
    return parseInt(Math.random() * 1000 + '').toString(16);
  }
  // 添加所需样式
  private insertStyle() {
    let $style = document.getElementById('x-drag-style');
    if (!$style) {
      $style = document.createElement('style');
      $style.setAttribute('id', 'x-drag-style');
      $style.innerHTML = `
        .x-draggable-wrap {
          display: flex;
          flex-direction: column;
        }
        .x-draggable-item {
          cursor: move;
        }
        .x-draggable-item > * {
          pointer-events: none;
        }
        .x-draggable-clone {
          position: fixed;
          top: 0;
          left: 0;
          z-index: 9998;
        }

        #x-draggable-mask {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
          cursor: move;
          user-select: none;
        }
        #x-draggable-mask.right {
          cursor: w-resize;
        }
        #x-draggable-mask.left {
          cursor: w-resize;
        }
        #x-draggable-mask.top {
          cursor: n-resize;
        }
        #x-draggable-mask.bottom {
          cursor: n-resize;
        }

        .x-draggable-size-wrap {
          position: relative;
          flex-shrink: 0 !important;
          flex-grow: 0 !important;
          box-sizing: border-box;
        }
        .x-draggable-size-wrap .x-draggable-handle {
          position: absolute;
        }
        .x-draggable-size-wrap .x-draggable-handle::after {
          content: '';
          display: block;
          position: absolute;
          background-color: #000;
        }
        .x-draggable-size-wrap.right .x-draggable-handle {
          width: 5px;
          cursor: w-resize;
          top: 0;
          bottom: 0;
          right: 0;
        }
        .x-draggable-size-wrap.right .x-draggable-handle::after {
          width: 1px;
          top: 0;
          bottom: 0;
          right: 0px;
        }
        .x-draggable-size-wrap.left .x-draggable-handle {
          width: 5px;
          cursor: w-resize;
          top: 0;
          bottom: 0;
          left: 0;
        }
        .x-draggable-size-wrap.left .x-draggable-handle::after {
          width: 1px;
          top: 0;
          bottom: 0;
          left: 0px;
        }
        .x-draggable-size-wrap.top .x-draggable-handle {
          height: 5px;
          cursor: n-resize;
          top: 0;
          right: 0;
          left: 0;
        }
        .x-draggable-size-wrap.top .x-draggable-handle::after {
          height: 1px;
          top: 0px;
          left: 0;
          right: 0;
        }
        .x-draggable-size-wrap.bottom .x-draggable-handle {
          height: 5px;
          cursor: n-resize;
          bottom: 0;
          right: 0;
          left: 0;
        }
        .x-draggable-size-wrap.bottom .x-draggable-handle::after {
          height: 1px;
          bottom: 0px;
          left: 0;
          right: 0;
        }
      `;
      document.head.appendChild($style);
    }
  }
}
