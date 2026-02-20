// TODO Export to own repo


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
  listeners;
  supportedEvents;
  
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
  
  disconnect() {
    this.listeners = null;
  }
}


export function listValue(value) {
  if (!value) {
    return [];
  }
  
  if (Array.isArray(value)) {
    return value;
  }
  
  try {
    value = JSON.parse(value);
  } catch (e) {
    return [value];
  }
  return Array.isArray(value) ? value : [value];
}

export function attributeInit(type, instance) {
  if (!type.attributeDefinitions || !instance.getAttribute) {
    return;
  }
  
  for (const { attribute, field } of type.attributeDefinitions) {
    instance[field] = instance.getAttribute(attribute);
  }
}

export function attributeGet(type, instance, fieldName) {
  if (!type.attributeDefinitions || !instance.getAttribute) {
    return null;
  }
  
  const target = type.attributeDefinitions.find(e => e.field === fieldName);
  if (!target) {
    return null;
  }
  
  const attributeName = target.attribute;
  
  if (target.type === 'boolean') {
    return instance.hasAttribute(attributeName);
  } else {
    let result = instance.getAttribute(attributeName);
    if (target.type === 'list') {
      if (!result) {
        return [];
      }
      
      try {
        result = JSON.parse(result);
      } catch (e) {
        return [result];
      }
      
      return Array.isArray(result) ? result : [result];
    }
    return target.type === 'list' ? listValue(result) : result;
  }
}

export function attributeSync(type, instance, fieldName, value) {
  if (!type.attributeDefinitions || !instance.setAttribute || !instance.getAttribute || !instance.removeAttribute) {
    return;
  }
  
  const target = type.attributeDefinitions.find(e => e.field === fieldName);
  if (!target) {
    return;
  }
  
  const attributeName = target.attribute;
  
  if (target.type === 'boolean') {
    value = value ?? false;
    if (value && instance.hasAttribute(attributeName) ||
        !value && !instance.hasAttribute(attributeName)) {
      return;
    }
    
    if (value) {
      instance.setAttribute(attributeName, '');
    } else {
      instance.removeAttribute(attributeName);
    }
    
  } else {
    value = value ?? null;
    
    if (target.type === 'list') {
      value = value && JSON.stringify(value);  
    }
    
    if (value == instance.getAttribute(attributeName)) {
      return;
    }
    
    if (value !== null) {
      instance.setAttribute(attributeName, value);
    } else {
      instance.removeAttribute(attributeName);
    }
  }
  
}

export function attributeChange(type, instance, name, oldValue, newValue) {
  if (!type.attributeDefinitions) {
    return;
  }
  
  const target = type.attributeDefinitions.find(e => e.attribute === name);
  if (target && instance[target.field] != newValue) {
    instance[target.field] = newValue;
  }
}

export async function loadTemplate(templateUrl) {
  return await fetch(templateUrl).then(resp => resp.text())
    .then(t => Document.parseHTMLUnsafe(t).querySelector('template'));
}

const downloadedStyles = {};

export const WebComponentMixin = (superclass, template, includeStylesheetAttribute, attributeDefinitions) => {
  
  attributeDefinitions = attributeDefinitions || [];
  if (includeStylesheetAttribute) {
    attributeDefinitions.push({ attribute: 'data-stylesheet-href', field: 'externalStyles', type: 'list' });
  }
  
  console.log(attributeDefinitions);
  
  const result = class extends superclass {
    
    static attributeDefinitions = attributeDefinitions;
    static observedAttributes = attributeDefinitions.map(e => e.attribute);
    
    constructor() {
      super();
      const shadowRoot = this.attachShadow({ mode: 'open' });
      shadowRoot.appendChild(document.importNode(template.content, true));
    }
    
    connectedCallback() {
      new Promise((resolve) => {
        attributeInit(result, this);
        resolve();
      });
    }
    
    attributeGet(fieldName) {
      return attributeGet(result, this, fieldName);
    }
    
    attributeSync(fieldName, value) {
      attributeSync(result, this, fieldName, value);
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
      attributeChange(result, this, name, oldValue, newValue);
    }
  };
  
  if (includeStylesheetAttribute) {
    Object.defineProperty(result.prototype, 'externalStyles', {
      get() {
        return this.attributeGet('externalStyles');
      },
      
      set (value) {
        if (!value) {
          this.shadowRoot.adoptedStyleSheets = [];
          return;
        }
        
        value = listValue(value);
        if (!value.length) {
          this.shadowRoot.adoptedStyleSheets = [];
          return;
        }
        
        const stylesheets = [];
        const promises = [];
        for (const href of value) {
          const current = downloadedStyles[href];
          if (current) {
            stylesheets.push(current)
          } else {
            promises.push(fetch(href).then(resp => resp.text()).then(text => {
              const sheet = new CSSStyleSheet();
              sheet.replaceSync(text);
              stylesheets.push(downloadedStyles[href] = sheet);
            }));
          }
        }
        
        Promise.all(promises).then(() => this.shadowRoot.adoptedStyleSheets = stylesheets);
        
      }
    });
  }
  
  return result;
}