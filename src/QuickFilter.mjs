
import { SimpleEventDispatcherMixin, hasAnyClass, collapseWhitespace, naturalCompare, convertPrimitive, removeChildren, quoteEscape } from './util.mjs';
import quickFilterStylesheet from './quick-filter.css' with { type: 'css' };
import quickFilterExternalStylesheet from './quick-filter-ext.css' with { type: 'css' };



document.adoptedStyleSheets.push(quickFilterExternalStylesheet);

const quickFilterTemplate = await fetch(import.meta.resolve('./quick-filter.html')).then(resp => resp.text())
    .then(t => Document.parseHTMLUnsafe(t).querySelector('template'));


function isRelationalApplicable(textFilter) {
  return typeof textFilter === 'boolean' || typeof textFilter === 'number' || typeof textFilter === 'string';
}

function doMatch(value, textFilter, relationalApplicable, textFilterType) {
  switch (textFilterType) {
    case 'contains':
      return value.indexOf(textFilter) !== -1;
    case 'starts-with':
      return value.startsWith(textFilter);
    case 'lt':
      return relationalApplicable && cellValue < textFilter;
    case 'le':
      return relationalApplicable && cellValue <= textFilter;
    case 'eq':
      return cellValue === textFilter;
    case 'ge':
      return relationalApplicable && cellValue >= textFilter;
    case 'gt':
      return relationalApplicable && cellValue > textFilter;
  }
}

const UNORDERED = Symbol('unordered');

class QuickFilterElement extends SimpleEventDispatcherMixin(HTMLElement, ['paramschange']) {
  
  static idCounter = 0;
  
  extractors;
  
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    shadowRoot.adoptedStyleSheets = [ quickFilterStylesheet ];
    shadowRoot.appendChild(document.importNode(quickFilterTemplate.content, true));
  }
  
  get table() {
    let current = this;
    while ((current = current.parentNode) && current.nodeName !== 'TABLE' && !current.classList.contains('quick-filter-managed'));
    return current;
  }
  
  get header() {
    let current = this;
    while ((current = current.parentNode) && current.nodeName !== 'TH' && !current.classList.contains('quick-filter-head'));
    return current;
  }
  
  get columnIndex() {
    const result = Number.parseInt(this.getAttribute('data-column-index'));
    return Number.isNaN(result) ? null : result;
  }
  
  get columnName() {
    return this.header?.textContent;
  }
  
  get order() {
    const result = this.shadowRoot.querySelector('.control-order').valueAsNumber;
    return Number.isNaN(result) ? UNORDERED : result;
  }
  
  set order(value) {
    this.shadowRoot.querySelector('.control-order').value = value;
  }
  
  get cooperationOperator() {
    return this.shadowRoot.querySelector('.cooperation-operator:checked').value;
  }
  
  set cooperationOperator(value) {
    const target = this.shadowRoot.querySelector(`.cooperation-operator[value="${value}"]`);
    (target || this.shadowRoot.querySelector('.cooperation-operator[value="and"]')).checked = true;
  }
  
  /**
   * Input type:
   * - `'adaptive'`
   * - `'direct'`
   */
  get inputType() {
    return this.shadowRoot.querySelector('.input-type:checked').value;
  }
  
  set inputType(value) {
    const target = this.shadowRoot.querySelector(`.input-type[value="${value}"]`);
    (target || this.shadowRoot.querySelector('.input-type[value="adaptive"]')).checked = true;
  }
  
  get caseSensitive() {
    return this.shadowRoot.querySelector('.case-sensitive').checked;
  }
  
  set caseSensitive(value) {
    this.shadowRoot.querySelector('.case-sensitive').checked = Boolean(value);
  }
  
  get sortDirection() {
    const selectedSort = this.shadowRoot.querySelector('.sort-direction:checked');
    if (!selectedSort) {
      return '';
    }
    return selectedSort.value === 'initial' ? '' : selectedSort.value;
  }
  
  set sortDirection(value) {
    const target = this.shadowRoot.querySelector(`.sort-direction[value="${value}"]`);
    (target || this.shadowRoot.querySelector('.sort-direction[value="initial"]')).checked = true;
  }
  
  get hasSortDirection() {
    return this.shadowRoot.querySelector('.sort-direction:checked').value !== 'initial';
  }
  
  get textFilter() {
    const textFilterType = this.textFilterType;
    return this.convertValue(this.shadowRoot.querySelector('.text-filter').value, textFilterType === 'contains' || textFilterType === 'starts-with');
  }
  
  set textFilter(value) {
    this.shadowRoot.querySelector('.text-filter').value = value;
  }
  
  /**
   * Text filter type:
   * - `'contains'`
   * - `'starts-with'`
   * - `'lt'`: Less than
   * - `'le'`: Less than or equal to
   * - `'eq'`: Equals
   * - `'ge'`: Greater than or equal to
   * - `'gt'`: Greater than
   */
  get textFilterType() {
    return this.shadowRoot.querySelector('.text-filter-type:checked').value;
  }
  
  set textFilterType(value) {
    const target = this.shadowRoot.querySelector(`.text-filter-type[value="${value}"]`);
    (target || this.shadowRoot.querySelector('.text-filter-type[value="contains"]')).checked = true;
  }
  
  get selectedValuesOperator() {
    return this.shadowRoot.querySelector('.selected-values-operator:checked').value;
  }
  
  set selectedValuesOperator(value) {
    const target = this.shadowRoot.querySelector(`.selected-values-operator[value="${value}"]`);
    (target || this.shadowRoot.querySelector('.selected-values-operator[value="or"]')).checked = true;
  }
  
  get selectedFilterValues() {
    const values = new Set();
    for (const input of this.shadowRoot.querySelectorAll('.filter-value:checked')) {
      values.add(this.convertValue(input.value));
    }
    
    return values;
  }
  
  get hasFilters() {
    return Boolean(this.shadowRoot.querySelector('.text-filter').value || this.shadowRoot.querySelector('.filter-value:checked'));
  }
  
  connectedCallback() {
    const rootNode = this.shadowRoot;
    rootNode.querySelector('.reset-filter').addEventListener('click', this);
    rootNode.querySelector('.quick-filter-close').addEventListener('click', this);
    
    for (const inputTypeRadio of rootNode.querySelectorAll('.input-type')) {
      inputTypeRadio.addEventListener('change', this);
    }
    
    rootNode.querySelector('.case-sensitive').addEventListener('change', this);
    rootNode.querySelector('.control-order').addEventListener('change', this);
    
    for (const cooperationOperator of rootNode.querySelectorAll('.cooperation-operator')) {
      cooperationOperator.addEventListener('change', this);
    }
    
    for (const sortDirectionRadio of rootNode.querySelectorAll('.sort-direction')) {
      sortDirectionRadio.addEventListener('change', this);
    }
    
    
    rootNode.querySelector('.text-filter').addEventListener('input', this);
    
    for (const selectedValuesOperator of rootNode.querySelectorAll('.selected-values-operator')) {
      selectedValuesOperator.addEventListener('change', this);
    }
    
    for (const textFilterType of rootNode.querySelectorAll('.text-filter-type')) {
      textFilterType.addEventListener('change', this);
    }
  }
  
  disconnectedCallback() {
    const rootNode = this.shadowRoot;
    rootNode.querySelector('.reset-filter').removeEventListener('click', this);
    rootNode.querySelector('.quick-filter-close').removeEventListener('click', this);
    
    for (const inputTypeRadio of rootNode.querySelectorAll('.input-type')) {
      inputTypeRadio.removeEventListener('change', this);
    }
    
    rootNode.querySelector('.case-sensitive').removeEventListener('change', this);
    rootNode.querySelector('.control-order').removeEventListener('change', this);
    
    for (const cooperationOperator of rootNode.querySelectorAll('.cooperation-operator')) {
      cooperationOperator.removeEventListener('change', this);
    }
    
    for (const sortDirectionRadio of rootNode.querySelectorAll('.sort-direction')) {
      sortDirectionRadio.removeEventListener('change', this);
    }
    
    rootNode.querySelector('.text-filter').removeEventListener('input', this);
    
    for (const valueFilter of rootNode.querySelectorAll('.filter-value')) {
      valueFilter.removeEventListener('change', this);
    }
    
    for (const selectedValuesOperator of rootNode.querySelectorAll('.selected-values-operator')) {
      selectedValuesOperator.removeEventListener('change', this);
    }
    
    for (const textFilterType of rootNode.querySelectorAll('.text-filter-type')) {
      textFilterType.removeEventListener('change', this);
    }
  }
  
  handleEvent(event) {
    if (
        hasAnyClass(event.target, 'text-filter') ||
        hasAnyClass(event.target, 'text-filter-type') && event.target.checked ||
        hasAnyClass(event.target, 'input-type') && event.target.checked ||
        hasAnyClass(event.target, 'sort-direction') && event.target.checked ||
        hasAnyClass(event.target, 'selected-values-operator') && event.target.checked ||
        hasAnyClass(event.target, 'control-order') ||
        hasAnyClass(event.target, 'filter-value') ||
        hasAnyClass(event.target, 'cooperation-operator') && event.target.checked ||
        hasAnyClass(event.target, 'case-sensitive')
    ) {
      this.updateConfigDisplay();
      this.emitEvent('paramschange');
    } else if (hasAnyClass(event.target, 'quick-filter-close')) {
      this.close();
    } else if (hasAnyClass(event.target, 'reset-filter')) {
      this.reset();
    }
  }
  
  getValues(cell) {
    let result;
    const extractors = this.extractors;
    if (extractors && extractors.length) {
      let targetExtractor;
      for (const extractor of extractors) {
        if (!extractor) continue;
        if (
            (typeof extractor.matches === 'function' && extractor.matches(this)) ||
            extractor.columnIndex == this.columnIndex ||
            extractor.columnName === this.columnName
        ) {
          targetExtractor = extractor;
          break;
        }
      }
      
      if (targetExtractor) {
        result = typeof targetExtractor.extractMultiple === 'function' ? targetExtractor.extractMultiple(cell) : [extractor.extract(cell)];
      }
    }
    
    if (!result) {
      result = [cell.textContent];
    }
    
    return result.map(e => this.convertValue(e));
  }
  
  convertValue(value, skipPrimitive) {
    value = collapseWhitespace(value);
    if (!this.caseSensitive) {
      value = value.toLowerCase();
    }
    if (this.inputType === 'adaptive' && !skipPrimitive) {
      value = convertPrimitive(value);
    }
    return value;
  }

  matchesText(cell) {
    const textFilter = this.textFilter;
    if (!textFilter) {
      return null;
    }
    
    const textFilterType = this.textFilterType;
    const relationalApplicable = isRelationalApplicable(textFilter);
    
    for (const value of this.getValues(cell)) {
      if (doMatch(value, textFilter, relationalApplicable, textFilterType)) {
        return true;
      }
    }
    
    return false;
  }
  
  hasSelected(cell) {
    const selectedFilterValues = this.selectedFilterValues;
    if (!selectedFilterValues.size) {
      return null;
    }
    
    for (const value of this.getValues(cell)) {
      if (selectedFilterValues.has(value)) {
        return true;
      }
    }
    
    return false;
  }
  
  rowMatches(row) {
    const columnIndex = this.columnIndex;
    if (columnIndex === null) {
      throw new TypeError('No column index found');
    }
    
    const cell = row.cells[columnIndex];
    
    const hasSelected = this.hasSelected(cell);
    const matchesText = this.matchesText(cell);
    
    if (hasSelected === null && matchesText === null) {
      return true;
    } else if (hasSelected === null) {
      return matchesText;
    } else if (matchesText === null) {
      return hasSelected;
    } else {
      return this.selectedValuesOperator === 'and' ? hasSelected && matchesText : hasSelected || matchesText;
    }
  }
  
  compareRows(rowA, rowB) {
    const columnIndex = this.columnIndex;
    if (columnIndex === null) {
      throw new TypeError('No column index found');
    }
    
    const sortDirection = this.sortDirection;
    if (!sortDirection) {
      return Number.parseInt(row.getAttribute('data-initial-index')) - Number.parseInt(b.getAttribute('data-initial-index'));
    }
    
    const aValue = this.getValues(rowA.cells[columnIndex]).reduce((v, e) => v + e);
    const bValue = this.getValues(rowB.cells[columnIndex]).reduce((v, e) => v + e);
    
    return (this.sortDirection === 'ascending' ? 1 : -1) * (aValue < bValue ? -1 : (aValue > bValue ? 1 : 0));
  }
  
  syncValues() {
    // Setup/sanity checks
    const table = this.table;
    if (!table) {
      throw new TypeError('No parent table found');
    }
    
    const columnIndex = this.columnIndex;
    if (columnIndex === null) {
      throw new TypeError('No column index found');
    }
    
    // Get current values
    const valuesList = this.shadowRoot.querySelector('.filter-values');
    let values = new Map();
    for (const row of table.tBodies[0].rows) {
      const cell = row.cells[columnIndex];
      const visible = cell.checkVisibility();
      
      for (const value of this.getValues(cell)) {
        const currentElement = valuesList.querySelector(`.filter-value[value="${quoteEscape(value)}"]`);
        
        if (values.has(value)) {
          const current = values.get(value);
          current.visible = Boolean(Math.max(current.visible, visible));
        } else {
          values.set(value, {
            visible: visible,
            selected: currentElement && currentElement.checked
          });
        }
        
      }
    }
    
    const adaptiveInput = this.inputType === 'adaptive';
    const rawText = this.shadowRoot.querySelector('.text-filter').value;
    const valuesArr = Array.from(values);
    valuesArr.sort((a, b) => {
      const [aValue, aState] = a;
      const [bValue, bState] = b;
      
      const aVisible = aState.visible;
      const bVisible = bState.visible;
      if (aVisible !== bVisible) {
        return bVisible - aVisible;  // -1 * (aVisible - bVisible); Want visible items sorted before non-visible.
      }
      
      const aSelected = values.get(aValue).selected;
      const bSelected = values.get(bValue).selected;
      if (aSelected && !bSelected) {
        return -1;
      } else if (bSelected && !aSelected) {
        return 1;
      }
      
      if (rawText) {
        const aContains = String(aValue).indexOf(rawText) !== -1;
        const bContains = String(bValue).indexOf(rawText) !== -1;
        if (aContains && !bContains) {
          return -1;
        } else if (bContains && !aContains) {
          return 1;
        }
      }
      
      return adaptiveInput ? naturalCompare(aValue, bValue) : (aValue < bValue ? -1 : (aValue > bValue ? 1 : 0));
    });
    
    
    // Update DOM
    removeChildren(valuesList);
    
    let counter = 0;
    for (const [value, state] of valuesArr) {
      const liElement = document.createElement('li');
      liElement.className = 'filter-value-item';
      if (!state.visible) {
        liElement.classList.add('filtered')
      }
      
      const valueCheckId = 'valueFilter_' + counter++;
      
      const valueCheck = document.createElement('input');
      valueCheck.id = valueCheckId;
      valueCheck.className = 'filter-value';
      valueCheck.name = 'valueFilter';
      valueCheck.value = value;
      valueCheck.type = 'checkbox';
      valueCheck.checked = state.selected;
      valueCheck.addEventListener('change', this);
      
      const valueCheckLabel = document.createElement('label');
      valueCheckLabel.htmlFor = valueCheckId;
      valueCheckLabel.textContent = value;
      
      liElement.appendChild(valueCheck);
      liElement.appendChild(valueCheckLabel);
      
      valuesList.appendChild(liElement);
    }
  }
  
  updateConfigDisplay() {
    const header = this.header;
    if (!header) {
      return;
    }
    
    let current = header.querySelector('.quick-filter-config');
    if (!current) {
      current = document.createElement('div');
      current.className = 'quick-filter-config';
      header.appendChild(current);
    }
    
    let sortDirectionDisplay = header.querySelector('.sort-direction');
    if (!sortDirectionDisplay) {
      sortDirectionDisplay = document.createElement('span');
      sortDirectionDisplay.className = 'sort-direction';
      current.appendChild(sortDirectionDisplay);
    }
    const sortDirection = this.sortDirection;
    sortDirectionDisplay.textContent = sortDirection === 'ascending' ? '\u25b2' : (sortDirection === 'descending' ? '\u25bc' : '');
    
    let commonConfig = header.querySelector('.common-config');
    if (!commonConfig) {
      commonConfig = document.createElement('span');
      commonConfig.className = 'common-config';
      current.appendChild(commonConfig);
    }
    
    let orderDisplay = header.querySelector('.column-order');
    if (!orderDisplay) {
      orderDisplay = document.createElement('span');
      orderDisplay.className = 'column-order';
      commonConfig.appendChild(orderDisplay);
    }
    const order = this.order;
    orderDisplay.textContent = order === UNORDERED ? '' : order;
    
    let conjunctionDisplay = header.querySelector('.conjunction-operator');
    if (!conjunctionDisplay) {
      conjunctionDisplay = document.createElement('span');
      conjunctionDisplay.className = 'conjunction-operator';
      commonConfig.appendChild(conjunctionDisplay);
    }
    conjunctionDisplay.textContent = (this.hasSortDirection || this.hasFilters) ? this.cooperationOperator : '';
  }
  
  open() {
    this.syncValues();
    
    for (const other of this.table.querySelectorAll('quick-filter')) {
      if (other !== this) {
        other.close();
      }
    }
    this.shadowRoot.querySelector('.quick-filter').classList.remove('closed');
  }
  
  close() {
    this.shadowRoot.querySelector('.quick-filter').classList.add('closed');
  }
  
  reset() {
    const rootNode = this.shadowRoot;
    
    this.inputType =
    this.cooperationOperator =
    this.caseSensitive =
    this.order =
    this.sortDirection =
    this.textFilter =
    this.textFilterType =
    this.selectedValuesOperator = '';
    
    for (const valueItem of rootNode.querySelectorAll('.filter-value-item')) {
      valueItem.classList.remove('filtered');
    }
    for (const valueInput of rootNode.querySelectorAll('.filter-value')) {
      valueInput.checked = false;
    }
    
    this.updateConfigDisplay();
    
    this.emitEvent('paramschange');
  }
}

customElements.define('quick-filter', QuickFilterElement);

export class QuickFilter {
  
  /**
   * @param {HTMLTableElement} table - Table to which to apply quick filter.
   * @param {QuickFilter~ColumnValueExtractor} [extractors[]] - Custom extractors.
   */
  constructor(table, extractors) {
    this.table = table;
    this.extractors = extractors;
  }
  
  async init() {
    const table = this.table;
    table.classList.add('quick-filter-managed');
    
    const headerCells = table.tHead.rows[0].querySelectorAll('th');
    for (let i = 0; i < headerCells.length; ++i) {
      const cell = headerCells[i];
      if (cell.classList.contains('no-quick-filter')) {
        continue;
      }
      cell.classList.add('quick-filter-head');
      cell.setAttribute('data-column-index', i);
      cell.addEventListener('click', this);
    }
    
    const bodyRows = table.tBodies[0].rows;
    for (let i = 0; i < bodyRows.length; ++i) {
      bodyRows[i].setAttribute('data-initial-index', i);
    }
  }
  
  handleEvent(event) {
    if (hasAnyClass(event.target, 'quick-filter-head')) {
      this.openQuickFilter(event.target);
    } else if (event.type === 'paramschange') {
      this.processFilters();
      this.processSort();
    }
  }
  
  get filterTree() {
    return new GroupParser(new GroupLexer(this.getQuickFilterGroups(e => e.hasFilters))).tree();
  }
  
  get sortGroups() {
    return this.getQuickFilterGroups(e => e.hasSortDirection);
  }
  
  
  getQuickFilterGroups(test) {
    const quickFilters = new Map();
    
    for (const quickFilter of this.table.querySelectorAll('quick-filter')) {
      if (!test(quickFilter)) {
        continue;
      }
      const order = quickFilter.order;
      let group = quickFilters.get(order);
      if (!group) {
        quickFilters.set(order, group = []);
      }
      group.push(quickFilter);
    }
    
    const groups = Array.from(quickFilters);
    groups.sort((a, b) => {
      const aOrder = a[0];
      const bOrder = b[0];
      if (aOrder === UNORDERED) {
        return 1;
      } else if (bOrder === UNORDERED) {
        return -1;
      } else {
        return aOrder - bOrder;
      }
    });
    
    return groups.map(e => e[1]);
  }
  
  processFilters(triggeringQuickFilter) {
    const table = this.table;
    const filterTree = this.filterTree;
    
    for (const row of table.tBodies[0].rows) {
      row.classList[filterTree.evaluate(row) ? 'remove' : 'add']('filtered');
    }
    for (const quickFilter of table.querySelectorAll('quick-filter')) {
      quickFilter.syncValues();
    }
  }
  
  processSort(triggeringQuickFilter) {
    const dataSection = this.table.tBodies[0];
    const rows = Array.from(dataSection.rows);
    
    const sortGroups = this.sortGroups;
    if (sortGroups.length) {
      rows.sort((a, b) => {
        for (const group of sortGroups) {
          for (const quickFilter of group) {
            const result = quickFilter.compareRows(a, b);
            if (result !== 0) {
              return result;
            }
          }
        }
      });
    } else {
      rows.sort((a, b) => Number.parseInt(a.getAttribute('data-initial-index')) - Number.parseInt(b.getAttribute('data-initial-index')));
    }
    
    removeChildren(dataSection);
    
    for (const row of rows) {
      dataSection.appendChild(row);
    }
  }
  
  openQuickFilter(headerElement) {
    let quickFilter = headerElement.querySelector('quick-filter');
    if (!quickFilter) {
      quickFilter = document.createElement('quick-filter');
      quickFilter.extractors = this.extractors;
      quickFilter.setAttribute('data-column-index', headerElement.getAttribute('data-column-index'));
      headerElement.appendChild(quickFilter);
      quickFilter.addEventListener('paramschange', this);
    }
    
    quickFilter.open();
  }
  
}

export class ListItemValueExtractor {
  
  constructor(matches) {
    this.matches = matches;
  }
  
  extractMultiple(cell) {
    const listItems = Array.from(cell.querySelectorAll('li'));
    if (listItems.length) {
      return listItems.map(e => e.textContent);
    } else {
      return [cell.textContent];
    }
  }
}


const TOKEN_EOF = ('TOKEN_EOF');
const TOKEN_GROUP_START = ('TOKEN_GROUP_START');
const TOKEN_GROUP_END = ('TOKEN_GROUP_END');
const TOKEN_FILTER = ('TOKEN_FILTER');
const TOKEN_AND = ('TOKEN_AND');
const TOKEN_OR = ('TOKEN_OR');

const NODE_ROOT = ('NODE_ROOT');
const NODE_GROUP = ('NODE_GROUP');
const NODE_OR = ('NODE_OR');
const NODE_AND = ('NODE_AND');
const NODE_FILTER = ('NODE_FILTER');

class GroupToken {
  type;
  value;
  
  constructor(type, value) {
    this.type = type;
    this.value = value;
  }
  
  evaluate(row) {
    switch (this.type) {
      case NODE_ROOT:
      case NODE_OR:
      case NODE_GROUP: {
        if (!this.value.length) {
          return true;
        }
        for (const node of this.value) {
          if (node.evaluate(row)) {
            return true;
          }
        }
        return false;
      }
      case NODE_AND: {
        if (!this.value.length) {
          return true;
        }
        for (const node of this.value) {
          if (!node.evaluate(row)) {
            return false;
          }
        }
        return true;
      }
      case NODE_FILTER: {
        return this.value.rowMatches(row);
      }
    }
  }
}

class GroupLexer {
  #groups;
  #gIndex = 0;
  #fIndex;
  #state = 0;
  #la;
  
  constructor(groups) {
    this.#groups = groups;
  }
  
  nextToken() {
    const la = this.#la;
    if (la) {
      this.#la = null;
      return la;
    } else {
      return this.#next();
    }
  }
  
  la() {
    const la = this.#la;
    if (la) {
      return la;
    } else {
      return this.#la = this.#next();
    }
  }
  
  #next() {
    switch (this.#state) {
      case 0: {
        if (this.#gIndex >= this.#groups.length) {
          return new GroupToken(TOKEN_EOF);
        }
        this.#fIndex = 0;
        this.#state = 1;
        return new GroupToken(TOKEN_GROUP_START);
      }
      case 1: {
        const group = this.#groups[this.#gIndex];
        const fIndex = this.#fIndex;
        if (fIndex >= group.length) {
          return new GroupToken(TOKEN_GROUP_END);
        }
        
        const filter = group[this.#fIndex];
        this.#state = 2;
        return new GroupToken(TOKEN_FILTER, filter);
      }
      case 2: {
        const group = this.#groups[this.#gIndex];
        
        const fIndex = this.#fIndex;
        const filter = group[fIndex];
        if (fIndex >= group.length - 1) {
          this.#state = 3;
          return new GroupToken(TOKEN_GROUP_END)
        } else {
          this.#state = 1;
          this.#fIndex++;
          return new GroupToken(filter.cooperationOperator === 'and' ? TOKEN_AND : TOKEN_OR);
        }
      }
      case 3: {
        const gIndex = this.#gIndex;
        const groups = this.#groups;
        
        const filter = groups[this.#gIndex][this.#fIndex];
        
        this.#state = 0;
        this.#gIndex++;
        
        if (gIndex >= groups.length - 1) {
          return new GroupToken(TOKEN_EOF);
        } else {
          return new GroupToken(filter.cooperationOperator === 'and' ? TOKEN_AND : TOKEN_OR);
        }
      }
        
    }
  }
}


class GroupParser {
  
  #lexer;
  
  constructor(lexer) {
    this.#lexer = lexer;
  }
  
  tree() {
    const lexer = this.#lexer;
    
    const groups = [];
    while (true) {
      if (lexer.la().type === TOKEN_EOF) {
        lexer.nextToken();
        break;
      }
      groups.push(this.orGroup());
    }
    return new GroupToken(NODE_ROOT, groups);
  }
  
  orGroup() {
    const lexer = this.#lexer;
    
    const orGroups = [];
    while (true) {
      orGroups.push(this.andGroup());
      if (lexer.la().type !== TOKEN_OR) {
        break;
      }
      lexer.nextToken();
    }
    
    return new GroupToken(NODE_OR, orGroups);
  }
  
  andGroup() {
    const lexer = this.#lexer;
    
    const andGroups = [];
    while (true) {
      andGroups.push(this.group());
      if (lexer.la().type !== TOKEN_AND) {
        break;
      }
      lexer.nextToken();
    }
    
    return new GroupToken(NODE_AND, andGroups);
  }
  
  group() {
    const lexer = this.#lexer;
    
    let tok = lexer.nextToken();
    if (tok.type !== TOKEN_GROUP_START) {
      throw new TypeError(JSON.stringify(tok));
    }
    
    const orExprs = [];
    while (true) {
      if (lexer.la().type === TOKEN_GROUP_END) {
        lexer.nextToken();
        break;
      }
      orExprs.push(this.orExpr());
    }
    return new GroupToken(NODE_GROUP, orExprs);
  }
  
  orExpr() {
    const lexer = this.#lexer;
    if (lexer.la().type !== TOKEN_FILTER) {
      throw new TypeError(JSON.stringify(lexer.la()));
    }
    
    const andExprs = [];
    while (true) {
      andExprs.push(this.andExpr());
      if (lexer.la().type !== TOKEN_OR) {
        break;
      }
      lexer.nextToken();
    }
    
    return new GroupToken(NODE_OR, andExprs);
  }
  
  andExpr() {
    const lexer = this.#lexer;
    
    const filterExprs = [];
    while (true) {
      if (lexer.la().type !== TOKEN_FILTER) {
        throw new TypeError(JSON.stringify(lexer.la()));
      }
      filterExprs.push(new GroupToken(NODE_FILTER, lexer.nextToken().value));
      if (lexer.la().type !== TOKEN_AND) {
        break;
      }
      lexer.nextToken();
    }
    
    return new GroupToken(NODE_AND, filterExprs);
  }
  
}

/**
 * @typedef {Object} QuickFilter~QuickFilterOptions
 * @property {QuickFilter~ColumnValueExtractor[]} [extractors] - Custom value extractors, if any. Empty list if omitted.
 *      {@link DefaultColumnValueExtractor} `push`ed on list regardless.
 */

/**
 * @interface QuickFilter~ColumnValueExtractor
 */

/**
 * @function
 * @name QuickFilter~ColumnValueExtractor#matches
 * @param {HTMLTableCellElement} header - `th` element to match
 * @returns {boolean} `true` if this extractor can extract values with cells associated with `header`, otherwise `false`.
 */

/**
 * @function
 * @name QuickFilter~ColumnValueExtractor#extract
 * @param {HTMLTableCellElement} cell - `td` to extract text for quick filter cell values for purposes
 *      of filtering and sorting.
 * @return {string} `cell`'s quick filter textual value.
 */

/**
 * Optional.
 *
 * @function
 * @name QuickFilter~ColumnValueExtractor#extractMultiple
 * @param {HTMLTableCellElement} cell - `td` to extract text for quick filter values. Use for multi-valued cells.
 *      Only used for the purpose of filtering.
 * @return {string[]} `cell`'s quick filter values.
 */
 