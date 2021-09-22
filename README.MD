# xh-draggable

实现任意元素、组件拖动、排序、改变大小，无需修改原组件代码

### 用法

```
import Draggable from 'xh-draggable';

const d = new Draggable(
    $dom, // 需要控制的元素元素
    options // 配置参数
);
d.on('dragOut', () => {
    .....
});

```

### 参数

参数 | 类型 | 默认值 | 说明
---|---|---|---
dragId | string |  | 拖动ID，在使用跨元素拖动时必传
isChildren | boolean | false | 元素内的子元素是否能被拖动
isAllowOut | boolean | false | 子元素是否能拖出父元素，跨元素拖动需设置为ture
isAllowIn | boolean | false | 其他子元素是否能拖入本元素，跨元素拖动需设置为ture
isSort | boolean | false | 是否支持拖动排序
resizeId | string |  | 元素可以被拖动改变宽度、高度
direction | right / left / top / bottom |  | 元素被拖动的改变方向

### 事件

事件 | 参数 | 说明
---|---|---
drag | {id: dragId, index: 索引} | 元素被拖动
