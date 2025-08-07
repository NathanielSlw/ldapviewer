// ============================================================================
// THEME MANAGEMENT
// ============================================================================

/**
 * Initialize theme based on user preference or system preference
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let currentTheme;
    if (savedTheme) {
        currentTheme = savedTheme;
    } else if (systemPrefersDark) {
        currentTheme = 'dark';
    } else {
        currentTheme = 'light';
    }
    
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateToggleSwitch(currentTheme);
}

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateToggleSwitch(newTheme);
}

/**
 * Update the visual state of the toggle switch
 */
function updateToggleSwitch(theme) {
    const slider = document.querySelector('.theme-toggle-slider');
    const sliderIcon = document.querySelector('.slider-icon');
    
    if (theme === 'dark') {
        slider.classList.add('dark');
        sliderIcon.textContent = '🌙​';
    } else {
        slider.classList.remove('dark');
        sliderIcon.textContent = '🔆';
    }
}

// ============================================================================
// DETAIL VIEW MANAGEMENT
// ============================================================================
// Functions for expanding/collapsing individual entries and bulk operations

/**
 * Toggles the visibility of a specific entry's attributes section
 * @param {string} id - The ID of the attributes container to toggle
 */
function toggle(id) {
    const elem = document.getElementById(id);
    const header = elem.previousElementSibling;
    if (elem.style.display === "none" || elem.style.display === "") {
        elem.style.display = "block";
        header.classList.add('expanded');
    } else {
        elem.style.display = "none";
        header.classList.remove('expanded');
    }
}

/**
 * Expands or collapses all attribute sections in detail view
 * @param {boolean} expand - True to expand all, false to collapse all
 */
function toggleAll(expand) {
    const all = document.getElementsByClassName("attributes");
    for (let e of all) {
        e.style.display = expand ? "block" : "none";
        const header = e.previousElementSibling;
        if (expand) {
            header.classList.add('expanded');
        } else {
            header.classList.remove('expanded');
        }
    }
}

function updateDetailButtons() {
    const expandBtn = document.getElementById('expandBtn');
    const collapseBtn = document.getElementById('collapseBtn');
    if (currentView === 'detail') {
        expandBtn.style.display = '';
        collapseBtn.style.display = '';
    } else {
        expandBtn.style.display = 'none';
        collapseBtn.style.display = 'none';
    }
}

// ============================================================================
// VIEW SWITCHING - MENU MANAGEMENT
// ============================================================================

function setActiveMenuButton(activeButton) {
    const menuButtons = document.querySelectorAll('.main-menu button');
    menuButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

/**
 * Switches between detail and table views
 * @param {string} view - Either 'detail' or 'table'
 */
function switchView(view) {
    const detailView = document.getElementById('detailView');
    const tableView = document.getElementById('tableView');
    const detailButtons = document.getElementById('detailButtons');
    const activeButton = event ? event.target : null;
    
    currentView = view;
    
    if (view === 'detail') {
        detailView.classList.remove('hidden');
        tableView.classList.add('hidden');
        detailButtons.style.display = 'flex';
        setActiveMenuButton(activeButton);
    } else if (view === 'table') {
        detailView.classList.add('hidden');
        tableView.classList.remove('hidden');
        detailButtons.style.display = 'none';
        setActiveMenuButton(activeButton);
    }
    
    // Re-apply all filters when switching views
    applyAllFilters();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getRIDFromObjectSID(objectSID) {
    if (!objectSID) return null;
    const parts = objectSID.split('-');
    const rid = parseInt(parts[parts.length - 1], 10);
    return isNaN(rid) ? null : rid;
}

function hasUACFlags(userAccountControl, flags) {
    if (!userAccountControl || flags.length === 0) return false;
    
    const uac = parseInt(userAccountControl, 10);
    if (isNaN(uac)) return false;
    
    return flags.every(flag => (uac & flag) !== 0);
}

function hasLDAPAttribute(entry, attributeName, expectedValue = null) {
    const attributeCell = Array.from(entry.getElementsByClassName('key'))
        .find(cell => cell.textContent === attributeName);
    
    if (!attributeCell) return false;
    
    const valueCell = attributeCell.nextElementSibling;
    if (!valueCell) return false;
    
    const attributeValue = valueCell.textContent.trim();
    
    if (expectedValue === null) {
        return attributeValue !== '';
    }
    
    return attributeValue === expectedValue;
}

// ============================================================================
// FILTERING SYSTEM
// ============================================================================
// Centralized filtering that applies all active filters together

let debounceTimer;
let currentView = 'detail';

// Filter states
let filterStates = {
    search: '',
    nonDefaultOnly: false,
    uac: {
        enabled: false,
        flags: []
    },
    ldapAttributes: {
        enabled: false,
        attributes: []
    }
};

/**
 * Main filtering function that applies all active filters
 */
function applyAllFilters() {
    if (currentView === 'detail') {
        applyFiltersToDetailView();
    } else {
        applyFiltersToTableView();
    }
    updateResultsCount();
}

/**
 * Apply all filters to detail view entries
 */
function applyFiltersToDetailView() {
    const entries = document.getElementsByClassName('entry');
    
    for (let entry of entries) {
        let shouldShow = true;
        
        // Apply search filter
        if (filterStates.search && shouldShow) {
            const text = entry.innerText.toLowerCase();
            shouldShow = text.includes(filterStates.search);
        }
        
        // Apply non-default filter
        if (filterStates.nonDefaultOnly && shouldShow) {
            const objectSIDCell = Array.from(entry.getElementsByClassName('key'))
                .find(cell => cell.textContent === 'objectSid');
            let rid = null;
            if (objectSIDCell) {
                const valueCell = objectSIDCell.nextElementSibling;
                rid = getRIDFromObjectSID(valueCell ? valueCell.textContent : "");
            }
            shouldShow = (rid !== null && rid >= 1000);
        }
        
        // Apply UAC filter
        if (filterStates.uac.enabled && shouldShow) {
            const uacCell = Array.from(entry.getElementsByClassName('key'))
                .find(cell => cell.textContent === 'userAccountControl');
            
            if (uacCell) {
                const valueCell = uacCell.nextElementSibling;
                const uacValue = valueCell ? valueCell.textContent : "";
                shouldShow = hasUACFlags(uacValue, filterStates.uac.flags);
            } else {
                shouldShow = false;
            }
        }
        
        // Apply LDAP attributes filter
        if (filterStates.ldapAttributes.enabled && shouldShow) {
            shouldShow = filterStates.ldapAttributes.attributes.every(attrFilter => 
                hasLDAPAttribute(entry, attrFilter.attribute, attrFilter.value)
            );
        }
        
        entry.style.display = shouldShow ? "" : "none";
    }
}

/**
 * Apply all filters to table view rows
 */
function applyFiltersToTableView() {
    const rows = document.querySelectorAll("#tableView tbody tr");
    const ths = document.querySelectorAll("#tableView thead th");
    
    // Find column indices once
    const objectSIDIndex = Array.from(ths).findIndex(th => th.textContent === "objectSid");
    const uacIndex = Array.from(ths).findIndex(th => th.textContent === "userAccountControl");
    
    rows.forEach(row => {
        let shouldShow = true;
        
        // Apply search filter
        if (filterStates.search && shouldShow) {
            const text = row.innerText.toLowerCase();
            shouldShow = text.includes(filterStates.search);
        }
        
        // Apply non-default filter
        if (filterStates.nonDefaultOnly && shouldShow) {
            let rid = null;
            if (objectSIDIndex !== -1) {
                const cell = row.cells[objectSIDIndex];
                rid = getRIDFromObjectSID(cell ? cell.textContent : "");
            }
            shouldShow = (rid !== null && rid >= 1000);
        }
        
        // Apply UAC filter
        if (filterStates.uac.enabled && shouldShow) {
            if (uacIndex !== -1) {
                const cell = row.cells[uacIndex];
                const uacValue = cell ? cell.textContent : "";
                shouldShow = hasUACFlags(uacValue, filterStates.uac.flags);
            } else {
                shouldShow = false;
            }
        }
        
        // Apply LDAP attributes filter
        if (filterStates.ldapAttributes.enabled && shouldShow) {
            shouldShow = filterStates.ldapAttributes.attributes.every(attrFilter => {
                const attrIndex = Array.from(ths).findIndex(th => th.textContent === attrFilter.attribute);
                
                if (attrIndex !== -1) {
                    const cell = row.cells[attrIndex];
                    const cellValue = cell ? cell.textContent.trim() : "";
                    
                    if (attrFilter.value === null) {
                        return cellValue !== '';
                    } else {
                        return cellValue === attrFilter.value;
                    }
                }
                return false;
            });
        }
        
        row.style.display = shouldShow ? "" : "none";
    });
}

/**
 * Search filter with debouncing
 */
function filterEntries() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        filterStates.search = document.getElementById('searchInput').value.toLowerCase();
        applyAllFilters();
    }, 150);
}

function updateResultsCount() {
    let total = 0, visibles = 0;
    if (currentView === 'detail') {
        const entries = document.getElementsByClassName('entry');
        total = entries.length;
        visibles = Array.from(entries).filter(e => e.style.display !== 'none').length;
    } else {
        const rows = document.querySelectorAll("#tableView tbody tr");
        total = rows.length;
        visibles = Array.from(rows).filter(r => r.style.display !== 'none').length;
    }
    const el = document.getElementById('resultsCount');
    if (el) el.textContent = `${visibles} result${visibles !== 1 ? 's' : ''} / ${total} object${total !== 1 ? 's' : ''}`;
}

// ============================================================================
// FILTER UI COMPONENTS
// ============================================================================

function toggleFilterDropdown() {
    const filterMenu = document.getElementById('filterMenu');
    const filterButton = document.querySelector('.filter-button');
    
    if (filterMenu.classList.contains('show')) {
        filterMenu.classList.remove('show');
        filterButton.classList.remove('open');
    } else {
        filterMenu.classList.add('show');
        filterButton.classList.add('open');
    }
}

function switchFilterTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.filter-tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
}

function toggleFilterChip(element, filterType) {
    element.classList.toggle('active');
    
    if (filterType === 'uac') {
        applyUACFilter();
    } else if (filterType === 'ldap') {
        applyLDAPAttributeFilter();
    }
    
    updateActiveFilterChips();
    updateFilterCount();
}

function toggleNonDefaultChip(element) {
    element.classList.toggle('active');
    filterStates.nonDefaultOnly = element.classList.contains('active');
    
    updateActiveFilterChips();
    updateFilterCount();
    applyAllFilters();
}

function updateActiveFilterChips() {
    const container = document.getElementById('activeFilterChips');
    container.innerHTML = '';
    
    // UAC filters
    const uacChips = document.querySelectorAll('#uacTab .filter-chip.active');
    uacChips.forEach(chip => {
        const chipElement = createActiveFilterChip(chip.textContent.trim(), 'uac', chip);
        container.appendChild(chipElement);
    });
    
    // LDAP filters
    const ldapChips = document.querySelectorAll('#ldapTab .filter-chip.active');
    ldapChips.forEach(chip => {
        const chipElement = createActiveFilterChip(chip.textContent.trim(), 'ldap', chip);
        container.appendChild(chipElement);
    });
    
    // Non-default filter
    const nonDefaultChip = document.getElementById('nonDefaultChip');
    if (nonDefaultChip && nonDefaultChip.classList.contains('active')) {
        const chipElement = createActiveFilterChip(nonDefaultChip.textContent.trim(), 'general', nonDefaultChip);
        container.appendChild(chipElement);
    }
}

function createActiveFilterChip(text, type, originalElement) {
    const chip = document.createElement('div');
    chip.className = 'filter-chip-active';
    chip.innerHTML = `
        ${text}
        <span class="remove-chip" onclick="removeActiveFilter('${type}', this)">✕</span>
    `;
    chip.dataset.originalElement = originalElement;
    return chip;
}

function removeActiveFilter(type, removeButton) {
    const chipElement = removeButton.parentElement;
    const originalElement = chipElement.dataset.originalElement;
    
    // Find and deactivate the original chip
    if (type === 'uac') {
        const uacChips = document.querySelectorAll('#uacTab .filter-chip.active');
        uacChips.forEach(chip => {
            if (chip.textContent.trim() === chipElement.textContent.replace('✕', '').trim()) {
                chip.classList.remove('active');
            }
        });
        applyUACFilter();
    } else if (type === 'ldap') {
        const ldapChips = document.querySelectorAll('#ldapTab .filter-chip.active');
        ldapChips.forEach(chip => {
            if (chip.textContent.trim() === chipElement.textContent.replace('✕', '').trim()) {
                chip.classList.remove('active');
            }
        });
        applyLDAPAttributeFilter();
    } else if (type === 'general') {
        const nonDefaultChip = document.getElementById('nonDefaultChip');
        nonDefaultChip.classList.remove('active');
        filterStates.nonDefaultOnly = false;
        applyAllFilters();
    }
    
    updateActiveFilterChips();
    updateFilterCount();
}

function updateFilterCount() {
    const activeCount = document.querySelectorAll('.filter-chip.active').length;
    document.getElementById('filterCount').textContent = activeCount;
}

function clearAllFilters() {
    // Clear all active chips
    document.querySelectorAll('.filter-chip.active').forEach(chip => {
        chip.classList.remove('active');
    });
    
    // Reset filter states
    filterStates.uac.enabled = false;
    filterStates.uac.flags = [];
    filterStates.ldapAttributes.enabled = false;
    filterStates.ldapAttributes.attributes = [];
    filterStates.nonDefaultOnly = false;
    
    updateActiveFilterChips();
    updateFilterCount();
    applyAllFilters();
    
    // Close dropdown
    toggleFilterDropdown();
}

function applyUACFilter() {
    const activeChips = document.querySelectorAll('#uacTab .filter-chip.active');
    const selectedFlags = Array.from(activeChips).map(chip => parseInt(chip.dataset.value, 10));
    
    filterStates.uac.enabled = selectedFlags.length > 0;
    filterStates.uac.flags = selectedFlags;
    
    applyAllFilters();
}

function applyLDAPAttributeFilter() {
    const activeChips = document.querySelectorAll('#ldapTab .filter-chip.active');
    const selectedAttributes = Array.from(activeChips).map(chip => ({
        attribute: chip.dataset.attribute,
        value: chip.dataset.value || null
    }));
    
    filterStates.ldapAttributes.enabled = selectedAttributes.length > 0;
    filterStates.ldapAttributes.attributes = selectedAttributes;
    
    applyAllFilters();
}

// ============================================================================
// CSV EXPORT FUNCTIONALITY
// ============================================================================

function exportCSV() {
    const activeButton = event ? event.target : null;
    
    if (activeButton) {
        activeButton.classList.add('active');
        setTimeout(() => {
            activeButton.classList.remove('active');
        }, 500);
    }

    const table = document.querySelector("#tableView table");
    if (!table) {
        alert("Le tableau n'est pas chargé !");
        return;
    }
    let csv = [];
    for (let row of table.rows) {
        let rowData = [];
        for (let cell of row.cells) {
            let text = cell.innerText.replace(/"/g, '""');
            if (text.includes(",") || text.includes("\n")) {
                text = `"${text}"`;
            }
            rowData.push(text);
        }
        csv.push(rowData.join(","));
    }
    const csvString = csv.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ldap_dump_export.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================================
// EVENT LISTENERS & INITIALIZATION
// ============================================================================

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    // Only apply system preference if user hasn't manually set a theme
    if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        updateToggleSwitch(newTheme);
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const filterDropdown = document.querySelector('.filter-dropdown');
    const filterMenu = document.getElementById('filterMenu');
    
    if (filterDropdown && !filterDropdown.contains(event.target)) {
        filterMenu.classList.remove('show');
        document.querySelector('.filter-button').classList.remove('open');
    }
});

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    initTheme();
    
    // Initialize active menu button
    const detailButton = document.querySelector('.main-menu button[onclick*="detail"]');
    if (detailButton) {
        detailButton.classList.add('active');
    }
    
    // Initialize UI state
    updateDetailButtons();
    updateResultsCount();
    updateFilterCount();
});