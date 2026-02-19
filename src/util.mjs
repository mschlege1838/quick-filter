
export function collapseWhitespace(value) {
  return value ? String(value).replaceAll(/\s+/g, ' ').trim() : '';
}

export function removeChildren(node) {
  while (node.childNodes.length) node.removeChild(node.childNodes[0]);
}

export function quoteEscape(value) {
  return String(value).replaceAll(/"/g, '\\"')
}

/**
 * Converts `val` type to `boolean` or `number` (or `bigint`) if sucessfully parsed,
 * otherwise returns `val`.
 * @returns Converted `val` if convertible otherwise `val` as `string`.
 */
export function convertPrimitive(val) {
  val = String(val);
  
  const valLower = val.toLowerCase().trim();
  if (valLower === 'true') {
    return true;
  }
  if (valLower === 'false') {
    return false;
  }
  
  if (/^[+-]?\d+(?:\.\d+)?(?:e\d+)?$/.test(valLower)) {
    const valNumber = Number.parseFloat(valLower);
    return Number.isNaN(valNumber) ? val : (Number.isFinite(valNumber) ? valNumber : BigInt(valLower));
  }
  
  return val;
}

export function naturalCompare(a, b) {
  if (a === b) {
    return 0;
  }
  
  if (a instanceof String) {
    a = a.toString();
  }
  if (b instanceof String) {
    b = b.toString();
  }
  
  const aIsString = typeof a === 'string';
  const bIsString = typeof b === 'string';
  if (aIsString) {
    a = convertPrimitive(a);
  }
  if (bIsString) {
    b = convertPrimitive(b);
  }
  
  const aIsBool = typeof a === 'boolean';
  const bIsBool = typeof b === 'boolean';
  if (aIsBool && bIsBool) {
    return a < b ? -1 : (a > b ? 1 : 0);
  } else if (aIsBool && !bIsBool) {
    return -1;
  } else if (!aIsBool && bIsBool) {
    return 1;
  }
  
  const aIsNumber = typeof a === 'number';
  const bIsNumber = typeof b === 'number';
  if (aIsNumber && bIsNumber) {
    return a < b ? -1 : (a > b ? 1 : 0);
  } else if (aIsNumber && !bIsNumber) {
    return -1;
  } else if (!aIsNumber && bIsNumber) {
    return 1;
  }
  
  const aIsBigInt = typeof a === 'bigint';
  const bIsBigInt = typeof b === 'bigint';
  if (aIsBigInt && bIsBigInt) {
    return a - b;
  } else if (aIsBigInt && !bIsBigInt) {
    return -1;
  } else if (!aIsBigInt && bIsBigInt) {
    return 1;
  }
  
  if (aIsString && bIsString) {
    const aBlank = /\s*/.test(a);
    const bBlank = /\s*/.test(b);
    if (aBlank && !bBlank) {
        return 1;
    } else if (!aBlank && bBlank) {
        return -1;
    }
    
    return a < b ? -1 : (a > b ? 1 : 0);
  } else if (aIsString && !bIsString) {
    return -1;
  } else if (!aIsString && bIsString) {
    return 1;
  }
  
  const aIsSymbol = typeof a === 'symbol';
  const bIsSymbol = typeof b === 'symbol';
  if (aIsSymbol && bIsSymbol) {
    const aStr = a.toString();
    const bStr = b.toString();
    return aStr < bStr ? -1 : (aStr > bStr ? 1 : 0);
  } else if (aIsSymbol && !bIsSymbol) {
    return -1;
  } else if (!aIsSymbol && bIsSymbol) {
    return 1;
  }
  
  const aIsFunction = typeof a === 'function';
  const bIsFunction = typeof b === 'function';
  if (aIsFunction && bIsFunction) {
    const aStr = a.name;
    const bStr = b.name;
    return aStr < bStr ? -1 : (aStr > bStr ? 1 : a.length - b.length);
  } else if (aIsFunction && !bIsFunction) {
    return -1;
  } else if (!aIsFunction && bIsFunction) {
    return 1;
  }
  
  return a < b ? -1 : (a > b ? 1 : 0);
}

export function hasAnyClass(element) {
  if (!element || !element.classList) {
    return false;
  }
  if (arguments.length === 2) {
    return element.classList.contains(arguments[1]);
  }
  for (const className of Array.prototype.slice.call(arguments, 1)) {
    if (element.classList.contains(className)) {
      return true;
    }
  }
  return false;
}

export const SimpleEventDispatcherMixin = (superclass, supportedEvents) => class extends superclass {
  constructor() {
    super(...arguments);
    this.listeners = {};
    this.supportedEvents = supportedEvents;
  }
  
  addEventListener(type, listener, options) {
    const supportedEvents = this.supportedEvents;
    if (supportedEvents && super.addEventListener) {
      let found = false;
      for (const supportedEvent of supportedEvents) {
        if (String(supportedEvent) === type) {
          found = true;
          break;
        }
      }
      
      if (!found) {
        super.addEventListener(type, listener, options);
        return;
      }
    }
    
    const listeners = this.listeners;
    
    let targetListeners = listeners[type];
    if (!targetListeners) {
      targetListeners = listeners[type] = []
    }
    const targetIndex = targetListeners.indexOf(listener);
    if (targetIndex === -1) {
      targetListeners.push(listener);
    }
  }
  
  removeEventListener(type, listener, options) {
    const supportedEvents = this.supportedEvents;
    if (supportedEvents && super.removeEventListener) {
      let found = false;
      for (const supportedEvent of supportedEvents) {
        if (String(supportedEvent) === type) {
          found = true;
          break;
        }
      }
      
      if (!found) {
        super.removeEventListener(type, listener, options);
        return;
      }
    }
    
    const targetListeners = this.listeners[type];
    if (!targetListeners) {
      return;
    }
    const targetIndex = targetListeners.indexOf(listener);
    if (targetIndex === -1) {
      return;
    }
    targetListeners.splice(targetIndex, 1);
  }
  
  emitEvent(type, event) {
    const targetListeners = this.listeners[type];
    if (!targetListeners) {
      return;
    }
    
    if (!event) {
      event = {};
    }
    event.type = type;
    event.target = event.currentTarget = this;
    
    for (const listener of targetListeners) {
      if (!listener) {
        throw Exception(`Invalid listener for event ${type}: ${listener}`);
      }
      
      if (typeof listener.handleEvent === 'function') {
        listener.handleEvent(event);
      } else if (typeof listener === 'function') {
        listener(event);
      } else {
        throw Exception(`Invalid listener for event ${type}: ${listener}`);
      }
    }
    
  }
}