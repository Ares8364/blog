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

function hasOwnProperty(target, prop) {
  if (typeof target !== 'object' || target === null) {
    return false
  } else if (Object.hasOwn) {
    return Object.hasOwn(target, prop)
  }
  const hasOwn = Object.prototype.hasOwnProperty
  return hasOwn.call(target, prop)
}
// target: string[] or Object.values(target) string[]
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
export const mapFunction = (mixin, target) => {
  const source = Object.keys(mixin).reduce((prev, next) => {
    if (typeof mixin[next] === 'function') {
      prev[next] = mixin[next]
    }
    return prev
  }, {})
  return mapObject(source, target)
}
