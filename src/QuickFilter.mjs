
import { IdAwareElement, SimpleEventDispatcherMixin, hasAnyClass, collapseWhitespace, naturalCompare, convertPrimitive } from './util.mjs';

let quickFilterTemplate, quickFilterStylesheet;

function getTemplate(baseDir) {
    if (!baseDir.endsWith('/')) {
        baseDir += '/';
    }
    if (!quickFilterTemplate) {
        const promises = [];
        promises.push(fetch(baseDir + 'quick-filter.html').then(resp => resp.text()).then(t => {
            quickFilterTemplate = Document.parseHTMLUnsafe(t).querySelector('template');
            document.body.appendChild(quickFilterTemplate);
        }));
        promises.push(fetch(baseDir + 'quick-filter-ext.css').then(resp => resp.text()).then(t => {
            const extStylesheet = new CSSStyleSheet();
            extStylesheet.replaceSync(t);
            document.adoptedStyleSheets.push(extStylesheet);
        }));
        promises.push(fetch(baseDir + 'quick-filter.css').then(resp => resp.text()).then(t => {
            quickFilterStylesheet = new CSSStyleSheet();
            quickFilterStylesheet.replaceSync(t);
        }));
        return Promise.all(promises);
    } else {
        return Promise.resolve();
    }
}

class QuickFilterElement extends SimpleEventDispatcherMixin(IdAwareElement, ['paramschange']) {
    
    static idCounter = 0;
    
    constructor() {
        super(quickFilterTemplate, quickFilterStylesheet);
    }
    
    /**
     * Input type:
     * - `'adaptive'`
     * - `'direct'`
     */
    get inputType() {
        return this.rootNode.querySelector('.input-type:checked').value;
    }
    
    get caseSensitive() {
        return this.rootNode.querySelector('.controls .case-sensitive').checked;
    }
    
    get sortDirection() {
        const selectedSort = this.rootNode.querySelector('.sort-direction:checked');
        if (!selectedSort) {
            return '';
        }
        return selectedSort.value === 'initial' ? '' : selectedSort.value;
    }
    
    set sortDirection(value) {
        if (!value) {
            value = 'initial';
        }
        for (const sortDirectionInput of this.rootNode.querySelectorAll('.sort-direction')) {
            sortDirectionInput.checked = sortDirectionInput.value === value;
        }
    }
    
    get sortOrder() {
        return this.rootNode.querySelector('.sort-order').valueAsNumber;
    }
    
    get textFilter() {
        return this.rootNode.querySelector('.text-filter').value;
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
        return this.rootNode.querySelector('.text-filter-type:checked').value;
    }
    
    get selectedValuesOperator() {
        return this.rootNode.querySelector('.selected-values-operator:checked').value;
    }
    
    get selectedFilterValues() {
        const result = new Set();
        for (const input of this.rootNode.querySelectorAll('.filter-value:checked')) {
            result.add(input.value);
        }
        return result;
    }
    
    init() {
        const rootNode = this.rootNode;
        rootNode.querySelector('.reset-filter').addEventListener('click', this);
        rootNode.querySelector('.quick-filter-close').addEventListener('click', this);
        
        for (const inputTypeRadio of rootNode.querySelectorAll('.input-type')) {
            inputTypeRadio.addEventListener('click', this);
        }
        
        for (const sortDirectionRadio of rootNode.querySelectorAll('.sort-direction')) {
            sortDirectionRadio.addEventListener('click', this);
        }
        
        rootNode.querySelector('.sort-order').addEventListener('change', this);
        rootNode.querySelector('.text-filter').addEventListener('input', this);
        
        for (const selectedValuesOperator of rootNode.querySelectorAll('.selected-values-operator')) {
            selectedValuesOperator.addEventListener('change', this);
        }
        
        for (const textFilterType of rootNode.querySelectorAll('.text-filter-type')) {
            textFilterType.addEventListener('change', this);
        }
        
        this.open();
    }
    
    disconnectedCallback() {
        const rootNode = this.rootNode;
        rootNode.querySelector('.reset-filter').removeEventListener('click', this);
        rootNode.querySelector('.quick-filter-close').removeEventListener('click', this);
        
        for (const inputTypeRadio of rootNode.querySelectorAll('.input-type')) {
            inputTypeRadio.removeEventListener('change', this);
        }
        
        for (const sortDirectionRadio of rootNode.querySelectorAll('.sort-direction')) {
            sortDirectionRadio.removeEventListener('change', this);
        }
        
        rootNode.querySelector('.sort-order').removeEventListener('change', this);
        rootNode.querySelector('.text-filter').removeEventListener('input', this);
        
        for (const valueFilter of rootNode.querySelector('.filter-value')) {
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
        if (hasAnyClass(event.target, 'text-filter') || hasAnyClass(event.target, 'text-filter-type') && event.target.checked) {
            this.syncValuesWithText();
            this.dispatchEvent('paramschange');
        } else if (
                hasAnyClass(event.target, 'input-type') && event.target.checked ||
                hasAnyClass(event.target, 'sort-direction') && event.target.checked ||
                hasAnyClass(event.target, 'selected-values-operator') && event.target.checked ||
                hasAnyClass(event.target, 'sort-order') ||
                hasAnyClass(event.target, 'filter-value')
        ) {
            this.dispatchEvent('paramschange');
        } else if (hasAnyClass(event.target, 'quick-filter-close')) {
            this.close();
        } else if (hasAnyClass(event.target, 'reset-filter')) {
            this.reset();
        }
    }
    
    syncValuesWithText() {
        const caseInsensitive = !this.caseSensitive;
        const adaptiveInput = this.inputType === 'adaptive';
        
        function normalize(v, skipAdaptive) {
            v = collapseWhitespace(v);
            if (caseInsensitive) {
                v = v.toLowerCase();
            }
            if (adaptiveInput && !skipAdaptive) {
                v = convertPrimitive(v);
            }
            return v;
        }
        
        let value = normalize(this.textFilter);
        if (!value) {
            for (const filterItem of this.rootNode.querySelectorAll('.filter-value-item')) {
                filterItem.classList.remove('filtered');
            }
            return;
        }
        
        
        const filterType = this.textFilterType;
        let filterFunction;
        switch (filterType) {
            case 'contains':
                filterFunction = v => normalize(v, true).indexOf(value) !== -1;
                break;
            case 'starts-with':
                filterFunction = v => normalize(v, true).startsWith(value);
                break;
            case 'lt':
                filterFunction = v => normalize(v) < value;
                break;
            case 'le':
                filterFunction = v => normalize(v) <= value;
                break;
            case 'eq':
                filterFunction = v => normalize(v) === value;
                break;
            case 'ge':
                filterFunction = v => normalize(v) >= value;
                break;
            case 'gt':
                filterFunction = v => normalize(v) > value;
                break;
            default:
                throw new TypeError('Unexpected filter type: ' + filterType);
        }
        
        for (const filterItem of this.rootNode.querySelectorAll('.filter-value-item')) {
            const filterInput = filterItem.querySelector('.filter-value');
            filterItem.classList.remove('filtered');
            if (!filterInput.checked && !filterFunction(filterInput.value)) {
                filterItem.classList.add('filtered');
            }
        }
    }
    
    syncValueFilter(values) {
        values = Array.from(values).map(collapseWhitespace);
        const valuesList = this.rootNode.querySelector('.filter-values');
        
        main: for (const value of values) {
            for (const currentValueInput of valuesList.querySelectorAll('.filter-value')) {
                if (currentValueInput.value === value) {
                    continue main;
                }
            }
            
            const liElement = document.createElement('li');
            liElement.className = 'filter-value-item';
            
            const valueCheckId = 'valueFilter' + QuickFilterElement.idCounter++;
            
            const valueCheck = document.createElement('input');
            valueCheck.id = valueCheckId;
            valueCheck.className = 'filter-value';
            valueCheck.name = 'valueFilter';
            valueCheck.value = value;
            valueCheck.type = 'checkbox';
            valueCheck.addEventListener('change', this);
            
            const valueCheckLabel = document.createElement('label');
            valueCheckLabel.htmlFor = valueCheckId;
            valueCheckLabel.textContent = value;
            
            liElement.appendChild(valueCheck);
            liElement.appendChild(valueCheckLabel);
            
            valuesList.appendChild(liElement);
        }
        
        for (const currentListItem of valuesList.querySelectorAll('.filter-value-item')) {
            const valueInput = currentListItem.querySelector('.filter-value');
            if (!valueInput.checked && values.indexOf(valueInput.value) === -1) {
                currentListItem.parentNode.removeChild(currentListItem);
            }
        }
        
        const currentValues = Array.from(valuesList.querySelectorAll('.filter-value-item'));
        const adaptiveInput = this.inputType === 'adaptive';
        currentValues.sort((a, b) => {
            const aValue = a.querySelector('.filter-value').value;
            const bValue = b.querySelector('.filter-value').value;
            
            return adaptiveInput ? naturalCompare(aValue, bValue) : (aValue < bValue ? -1 : (aValue > bValue ? 1 : 0));
        });
        for (const currentValue of currentValues) {
            valuesList.removeChild(currentValue);
            valuesList.appendChild(currentValue);
        }
    }
    
    open() {
        for (const other of document.querySelectorAll('quick-filter')) {
            if (other !== this) {
                other.close();
            }
        }
        this.rootNode.querySelector('.quick-filter').classList.remove('closed');
    }
    
    close() {
        this.rootNode.querySelector('.quick-filter').classList.add('closed');
    }
    
    reset() {
        const rootNode = this.rootNode;
        
        rootNode.querySelector('.input-type[value="adaptive"]').checked = true;
        rootNode.querySelector('.sort-direction[value="initial"]').checked = true;
        rootNode.querySelector('.sort-order').value = '';
        rootNode.querySelector('.text-filter').value = '';
        rootNode.querySelector('.text-filter-type[value="contains"]').checked = true;
        rootNode.querySelector('.selected-values-operator[value="or"]').checked = true;
        
        for (const valueItem of rootNode.querySelectorAll('.filter-value-item')) {
            valueItem.classList.remove('filtered');
        }
        for (const valueInput of rootNode.querySelectorAll('.filter-value')) {
            valueInput.checked = false;
        }
        
        this.dispatchEvent('paramschange');
    }
}

customElements.define('quick-filter', QuickFilterElement);

export class QuickFilter {
    
    /**
     * @param {string} baseDir - QuickFilter base directory in application.
     * @param {HTMLTableElement} table - Table to which to apply quick filter.
     * @param {QuickFilter~QuickFilterOptions} [options] - Additional options, if any.
     */
    constructor(baseDir, table, options) {
        this.baseDir = baseDir;
        this.table = table;
        const extractors = this.extractors = options && options.extractors || [];
        extractors.push(new DefaultColumnValueExtractor());
    }
    
    init() {
        const table = this.table;
        table.classList.add('quick-filter-managed');
        
        const headerCells = table.tHead.rows[0].cells;
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
            this.processFilters(event.target);
            this.syncSortConfiguration(event.target);
            this.processSort(event.target);
        }
    }
    
    get columns() {
        const quickFilterHeaders = this.table.querySelectorAll('.quick-filter-head');
        const extractors = this.extractors;
        return {
            *[Symbol.iterator]() {
                for (const header of quickFilterHeaders) {
                    const quickFilter = header.querySelector('quick-filter');
                    if (!quickFilter) {
                        continue;
                    }
                    
                    const columnIndex = Number.parseInt(header.getAttribute('data-column-index'));
                    
                    let extractor;
                    for (extractor of extractors) {
                        if (extractor.matches(header)) {
                            break;
                        }
                    }
                    yield [ columnIndex, header, quickFilter, extractor ];
                }
            }
        }
    }
    
    processFilters(triggeringQuickFilter) {
        const dataSection = this.table.tBodies[0];
        
        for (const [ columnIndex, header, quickFilter, extractor ] of this.columns) {
            // Common config
            const adaptiveInput = quickFilter.inputType === 'adaptive';
            const caseSensitive = !quickFilter.caseSensitive;
            
            
            // Process value filters
            let selectedFilterValues = quickFilter.selectedFilterValues;
            if (selectedFilterValues.size) {
                // Remove case if needed
                if (caseSensitive) {
                    const temp = new Set();
                    for (const value of selectedFilterValues) {
                        temp.add(value.toLowerCase());
                    }
                    selectedFilterValues = temp;
                }
                
                // Convert to primitive if needed
                if (adaptiveInput) {
                    const temp = new Set();
                    for (const value of selectedFilterValues) {
                        temp.add(convertPrimitive(value));
                    }
                    selectedFilterValues = temp;
                }
                
                // Process table
                for (const row of dataSection.rows) {
                    // Get cell value
                    const cell = row.cells[columnIndex];
                    
                    let cellValues = (typeof extractor.extractMultiple === 'function' ? extractor.extractMultiple(cell) : [extractor.extract(cell)])
                        .map(collapseWhitespace);
                    
                    // Remove case if needed
                    if (caseSensitive) {
                        cellValues = cellValues.map(e => e.toLowerCase());
                    }
                    
                    // Convert to primitive if needed
                    if (adaptiveInput) {
                        cellValues = cellValues.map(convertPrimitive);
                    }
                    
                    
                    // Apply/remove filter classnames
                    let found = false;
                    for (const cellValue of cellValues) {
                        if (selectedFilterValues.has(cellValue)) {
                            cell.classList.add('value-selected');
                            for (const filteredCell of row.querySelectorAll('.value-filtered')) {
                                filteredCell.classList.remove('value-filtered');
                            }
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        cell.classList.remove('value-selected');
                        if (!row.querySelector('.value-selected')) {
                            cell.classList.add('value-filtered');
                        }
                    }
                }
            } else {
                for (const classname of [ 'value-filtered', 'value-selected' ]) {
                    for (const filteredCell of dataSection.querySelectorAll(`.${classname}`)) {
                        filteredCell.classList.remove(classname);
                    }
                }
            }
            
            //  Then text
            let textFilter = collapseWhitespace(quickFilter.textFilter);
            if (textFilter) {
                const textFilterType = quickFilter.textFilterType;
                const orRelationship = quickFilter.selectedValuesOperator === 'or';
                
                const doConvert = adaptiveInput && textFilterType !== 'contains' && textFilterType !== 'starts-with';
                
                if (caseSensitive) {
                    textFilter = textFilter.toLowerCase();
                }
                
                if (doConvert) {
                    textFilter = convertPrimitive(textFilter);
                }
                
                for (const row of dataSection.rows) {
                    const cell = row.cells[columnIndex];
                    
                    let cellValues = (typeof extractor.extractMultiple === 'function' ? extractor.extractMultiple(cell) : [extractor.extract(cell)])
                        .map(collapseWhitespace);
                    
                    if (caseSensitive) {
                        cellValues = cellValues.map(e => e.toLowerCase());
                    }
                    
                    if (doConvert) {
                        cellValues = cellValues.map(convertPrimitive);
                    }
                    
                    const relationalApplicable = typeof textFilter === 'boolean' || typeof textFilter === 'number' || typeof textFilter === 'string';
                    
                    let filterMatch = false;
                    for (const cellValue of cellValues) {
                        switch (textFilterType) {
                            case 'contains':
                                filterMatch = cellValue.indexOf(textFilter) !== -1;
                                break;
                            case 'starts-with':
                                filterMatch = cellValue.startsWith(textFilter);
                                break;
                            case 'lt':
                                filterMatch = relationalApplicable && cellValue < textFilter;
                                break;
                            case 'le':
                                filterMatch = relationalApplicable && cellValue <= textFilter;
                                break;
                            case 'eq':
                                filterMatch = cellValue === textFilter;
                                break;
                            case 'ge':
                                filterMatch = relationalApplicable && cellValue >= textFilter;
                                break;
                            case 'gt':
                                filterMatch = relationalApplicable && cellValue > textFilter;
                                break;
                        }
                        
                        if (filterMatch) {
                            cell.classList.remove('text-filtered');
                            if (orRelationship && cell.classList.contains('value-filtered')) {
                                cell.classList.remove('value-filtered');
                            }
                            break;
                        }
                    }
                    
                    if (!filterMatch && (!orRelationship || !cell.classList.contains('value-selected'))) {
                        cell.classList.add('text-filtered');
                    }
                }
            } else {
                for (const filteredCell of dataSection.querySelectorAll('.text-filtered')) {
                    filteredCell.classList.remove('text-filtered');
                }
            }
            
        }
    }
    
    syncSortConfiguration(triggeringQuickFilter) {
        let maxSortOrder = 0;
        
        for (const [ columnIndex, header, quickFilter, extractor ] of this.columns) {
            
            const sortDirection = quickFilter.sortDirection;
            const sortOrder = quickFilter.sortOrder;
            
            let sortConfigurationElement = header.querySelector('.sort-configuration-indicator');
            // If a sort direction is specified, but no sort order AND this quick filter isn't the most recently touched,
            //   remove sortConfigurationElement if present and reset quick-filter.
            if (!sortDirection || Number.isNaN(sortOrder) && quickFilter !== triggeringQuickFilter) {
                if (sortConfigurationElement) {
                    sortConfigurationElement.parentNode.removeChild(sortConfigurationElement);
                }
                quickFilter.sortDirection = '';
            }
            // Otherwise sort configuration is valid, update sort indicators (create if not present)
            else {
                let sortDirectionElement, sortOrderElement;
                if (sortConfigurationElement) {
                    sortDirectionElement = sortConfigurationElement.querySelector('.sort-direction-indicator');
                    sortOrderElement = sortConfigurationElement.querySelector('.sort-order-indicator');
                } else {
                    sortConfigurationElement = document.createElement('span');
                    sortConfigurationElement.className = 'sort-configuration-indicator';
                    quickFilter.parentNode.insertBefore(sortConfigurationElement, quickFilter);
                    
                    sortDirectionElement = document.createElement('span');
                    sortDirectionElement.className = 'sort-direction-indicator';
                    sortConfigurationElement.appendChild(sortDirectionElement);
                    
                    sortOrderElement = document.createElement('sup');
                    sortOrderElement.className = 'sort-order-indicator';
                    sortConfigurationElement.appendChild(sortOrderElement);
                }
                
                sortDirectionElement.textContent = sortDirection === 'ascending' ? '\u25b2' : '\u25bc';
                sortOrderElement.textContent = Number.isNaN(sortOrder) ? '' : sortOrder;
            }
        }
    }
    
    processSort(triggeringQuickFilter) {
        const allSortParams = [];
        let triggeringSortParams;
        for (const [ columnIndex, header, quickFilter, extractor ] of this.columns) {
            if (!quickFilter.sortDirection) {
                continue;
            }
            
            const sortOrder = quickFilter.sortOrder;
            if (!Number.isNaN(sortOrder)) {
                allSortParams.push({
                    sortOrder: sortOrder,
                    quickFilter: quickFilter,
                    extractor: extractor,
                    columnIndex: columnIndex
                });
            } else if (quickFilter === triggeringQuickFilter) {
                triggeringSortParams = {
                    sortOrder: sortOrder,
                    quickFilter: quickFilter,
                    extractor: extractor,
                    columnIndex: columnIndex
                };
            }
        }
        
        const dataSection = this.table.tBodies[0];
        
        const nonFiltered = [];
        for (const row of dataSection.rows) {
            if (!row.querySelector('.value-filtered, .text-filtered')) {
                nonFiltered.push(row);
            }
        }
        
        for (const row of nonFiltered) {
            dataSection.removeChild(row);
        }
        
        if (allSortParams.length) {
            allSortParams.sort((a, b) => a.sortOrder - b.sortOrder);
            if (triggeringSortParams) {
                allSortParams.push(triggeringSortParams);
            }
            nonFiltered.sort((a, b) => {
                let result = 0;
                let isDesc = false;
                for (const sortParams of allSortParams) {
                    const quickFilter = sortParams.quickFilter;

                    const aValue = sortParams.extractor.extract(a.cells[sortParams.columnIndex]);
                    const bValue = sortParams.extractor.extract(b.cells[sortParams.columnIndex]);
                    
                    let result;
                    switch (quickFilter.inputType) {
                        case 'adaptive':
                            result = naturalCompare(aValue, bValue);
                            break;
                        case 'direct':
                            result = aValue < bValue ? -1 : (aValue > bValue ? 1 : 0);
                            break;
                    }
                    
                    if (result !== 0) {
                        return quickFilter.sortDirection === 'descending' ? -1 * result : result;
                    }
                  
                }
                
                return 0;
            });
        } else {
            nonFiltered.sort((a, b) => Number.parseInt(a.getAttribute('data-initial-index')) - Number.parseInt(b.getAttribute('data-initial-index')));
        }
        
        for (const row of nonFiltered) {
            dataSection.appendChild(row);
        }
        
    }
    
    async openQuickFilter(headerElement) {
        let quickFilter = headerElement.querySelector('quick-filter');
        if (quickFilter) {
            quickFilter.open();
        } else {
            await getTemplate(this.baseDir);
            quickFilter = document.createElement('quick-filter');
            headerElement.appendChild(quickFilter);
            quickFilter.addEventListener('paramschange', this);
        }
        
        let extractor;
        for (extractor of this.extractors) {
            if (extractor.matches(headerElement)) {
                break;
            }
        }
        
        
        const columnIndex = Number.parseInt(headerElement.getAttribute('data-column-index'));
        const values = [];
        for (const row of this.table.tBodies[0].rows) {
            if (!row.classList.contains('filtered')) {
                const cell = row.cells[columnIndex];
                if (typeof extractor.extractMultiple === 'function') {
                    values.push(...extractor.extractMultiple(cell));
                } else {
                    values.push(extractor.extract(cell));
                }
            }
        }
        
        quickFilter.syncValueFilter(values);
    }
    
}

export class DefaultColumnValueExtractor {
    
    matches() {
        return true;
    }
    
    extract(cell) {
        return cell.textContent;
    }
}

export class ListItemValueExtractor extends DefaultColumnValueExtractor {
    
    constructor(matches) {
        super();
        this.matches = matches;
    }
    
    extractMultiple(cell) {
        const listItems = Array.from(cell.querySelectorAll('li'));
        if (listItems.length) {
            return listItems.map(e => e.textContent);
        } else {
            return [this.extract(cell)];
        }
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