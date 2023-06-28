昨日看到一篇文章，[我可能发现了Vue Mixin的正确用法——动态Mixin](https://juejin.cn/post/7244070072787763256),文章列举了mixin的几个缺点：

1. 来源不明：使用的 mixins 越多，越难找到某个属性或方法来自哪里
2. 无法精确引入：引入一个 mixin 时，会引入这个 mixin 的全部属性，因此很可能会引入一些用不到的东西，也会导致很难清楚知道到底引入了哪些属性和方法
3. 命名冲突：引入多个 mixins 时，引入的属性名可能会冲突
4. 耦合问题：不规范地使用 mixins 功能，可能会导致耦合问题，比如因为组件太大而抽离一部分属性到 mixins 中，这样产生的 mixins 一般会互相依赖，造成强耦合

为了解决这些问题，私以为可以效仿store的辅助函数的写法，即通过创建辅助函数返回需要的mixin对象。

## 动态mixin的优势

动态mixin允许我们根据特定的入参动态返回所需的mixin对象。这种灵活性使得我们可以根据具体情况选择合适的mixin，并避免了无用的引入。

先看看store的辅助函数写法吧

`mapGetters` 辅助函数仅仅是将 store 中的 getter 映射到局部计算属性：

````js
import { mapGetters } from 'vuex'

export default {
  // ...
  computed: {
  // 使用对象展开运算符将 getter 混入 computed 对象中
    ...mapGetters([
      'doneTodosCount',
      'anotherGetter',
      // ...
    ])
  }
}
````

如果你想将一个 getter 属性另取一个名字，使用对象形式：

```js
...mapGetters({
  // 把 `this.doneCount` 映射为 `this.$store.getters.doneTodosCount`
  doneCount: 'doneTodosCount'
})
```

辅助函数mapGetters根据入参，从getters中过滤需要的属性，最后返回一个对象回来，其他的mapMutations、mapActions也类似，当然mapMutations、mapActions肯定做了一定处理，返回的函数只是调用store里方法的外层函数，这样保证store函数实参是合理的。

这样，mixin辅助函数最后使用的情况也确定了

````js
...mapProps(['name', 'title'])
````

考虑到mixin会有多个，那么需要确定是从那个mixin里面获取需要的属性

还是再来看看store的辅助函数如何解决的，默认情况下，mapGetters是直接获取所需属性，如果需要获取modules里命令空间里的getters，需要添加命令空间名，也就是个前缀

````js
computed: {
  ...mapState({
    a: state => state.some.nested.module.a,
    b: state => state.some.nested.module.b
  })
},
methods: {
  ...mapActions([
    'some/nested/module/foo', // -> this['some/nested/module/foo']()
    'some/nested/module/bar' // -> this['some/nested/module/bar']()
  ])
}
````

```js
computed: {
  ...mapState('some/nested/module', {
    a: state => state.a,
    b: state => state.b
  })
},
methods: {
  ...mapActions('some/nested/module', [
    'foo', // -> this.foo()
    'bar' // -> this.bar()
  ])
}
```

这里我们参照最常用的第二种写法，照搬套过来就是

````js
import mixin from '@/mixins/test.mixin.js'
...
...mapProps(mixin ,['name', 'title'])
````

Ok, 现在可以开始写函数了,写完大概是这个样子，source是mixin原对象，target是需要引入的属性（对象or数组）。因为vue2的选项很多多是对象，所以直接讲过程抽出一个函数mapObject，将选项属性propName传入

```js
const mapObject = (source, target, propName) => {
  if (typeof target !== 'object' || target === null) {
    throw new Error('parameter target must be an object for mapObject')
  }
  if (typeof propName !== 'string' && propName) {
    throw new Error('parameter propName must be an string or undefined for mapObject')
  }
  let res
  if (typeof source === 'object' && source !== null) {
    if (Array.isArray(target)) {
       res = target.reduce((prev, next) => {
        if (hasOwnProperty(source, next)) {
          prev[next] = source[next]
        }
        return prev
      }, {})
    } else {
      res = Object.keys(target).reduce((prev, next) => {
        if (hasOwnProperty(source, next)) {
          prev[target[next]] = source[next]
        }
        return prev
      }, {})
    }
    return propName ? { [propName]: res } : res
  } else {
    return {}
  }
}
export const mapProps = (mixin, target) => {
  const source = mixin['props']
  return mapObject(source, target, 'props')
}
function hasOwnProperty(target, prop) {
  if (typeof target !== 'object' || target === null) {
    return false
  } else if (Object.hasOwn) {
    return Object.hasOwn(target, prop)
  }
  const hasOwn = Object.prototype.hasOwnProperty
  return hasOwn.call(target, prop)
}
```

仿照mapProps，可以依次得到以下辅助函数，因为data属性在mixin里可能是个函数类型，所有要做一下简单处理，并且不管mixin里data是不是函数，我们一律在转化后变成函数。

````js
export const mapData = (mixin, target) => {
  const source = typeof mixin['data'] === 'function' ? mixin['data']() : mixin['data']
  const result = mapObject(source, target, 'data')
  return {
    data() {
      return { ...result.data }
    }
  }
}
export const mapComputed = (mixin, target) => {
  const source = mixin['computed']
  return mapObject(source, target, 'computed')
}
export const mapWatch = (mixin, target) => {
  const source = mixin['watch']
  return mapObject(source, target, 'watch')
}
export const mapMethods = (mixin, target) => {
  const source = mixin['methods']
  return mapObject(source, target, 'methods')
}
export const mapDirectives = (mixin, target) => {
  const source = mixin['directives']
  return mapObject(source, target, 'directives')
}
export const mapFilters = (mixin, target) => {
  const source = mixin['filters']
  return mapObject(source, target, 'filters')
}
export const mapComponents = (mixin, target) => {
  const source = mixin['components']
  return mapObject(source, target, 'components')
}
````

是不是还漏了什么，好像是钩子函数，十几个生命周期也需要，一样加上

````js
export const mapFunction = (mixin, target) => {
  const source = Object.keys(mixin).reduce((prev, next) => {
    if (typeof mixin[next] === 'function') {
      prev[next] = mixin[next]
    }
    return prev
  }, {})
  return mapObject(source, target)
}
````

到此，一般情况下的用到的mixin都好了，接下来考虑一种情况，如果某个mixin大多数都要引入，且这个mixin选项很多，那代码量太多了，所以不如一个整合函数，返回所有需要的属性，这个函数做的事也很简单，把上面函数全部都执行一遍，结果assign就行了，如下

````js
function mapMixin(mixin, target) {
  let result = {}
  const funcList = [mapProps, mapData, mapComputed, mapWatch, mapMethods, mapDirectives, mapFilters, mapComponents, mapFunction]
  funcList.forEach(func => {
    result = Object.assign(result, func(mixin, target))
  })
  return result
}
````

好像还有优化的空间，比如可以写个生成器函数，返回这个函数，mixin就可以由外部函数接收，这样在每个mixin模块文件里，引入这个生成器函数，返回这个函数的执行结果。页面引入时就可以直接传入target就行了，更简洁，还可以做一层结果缓存，大概如下

````js
export default (mixin) => {
  const cache = {}
  if (typeof mixin === 'object' && mixin !== null) {
    return function (target) {
      if (cache[JSON.stringify(target)]) {
        return cache[JSON.stringify(target)]
      }
      let result = {}
      const funcList = [mapProps, mapData, mapComputed, mapWatch, mapMethods, mapDirectives, mapFilters, mapComponents, mapFunction]
      funcList.forEach(func => {
        result = Object.assign(result, func(mixin, target))
      })
      cache[JSON.stringify(target)] = result
      return result
   }
  } else {
    throw new Error('parameter mixin must be an object for mapMixin')
  }
}
````

实际用法

````js
import test1Mixin from '@/mixins/modules/test1.mixin'


...
mixins:[ test1Mixin({ name: 'testName', value: 'testValue' }) ]
````

回到题目，动态mixin是否解决了上述四个问题，

1. 来源不明

2. 无法精确引入

3. 命名冲突

4. 耦合问题

好像耦合问题，还是比较依赖开发者自己。

在封装的过程中，对于mixins属性，没有写到辅助函数里面，主要是这样mapMixin函数要递归查询有没有目标属性，如果有要处理合并属性，同名优先级等问题，而这个实际上用的比较少吧，也不如页面另外引入，最最重要的是，我也的确比较懒