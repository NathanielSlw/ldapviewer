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

// Initialize theme when page loads
document.addEventListener('DOMContentLoaded', function() {
    initTheme();
});

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    // Only apply system preference if user hasn't manually set a theme
    if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        updateToggleSwitch(newTheme);
    }
});


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

// ============================================================================
// UNIFIED FILTERING SYSTEM
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

/**
 * Toggle non-default objects filter
 */
function toggleNonDefault() {
    filterStates.nonDefaultOnly = document.getElementById('nonDefaultCheckbox').checked;
    applyAllFilters();
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
// UI BUTTON STATE MANAGEMENT
// ============================================================================

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

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    const detailButton = document.querySelector('.main-menu button[onclick*="detail"]');
    if (detailButton) {
        detailButton.classList.add('active');
    }
    updateDetailButtons();
    updateResultsCount(); 
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRIDFromObjectSID(objectSID) {
    if (!objectSID) return null;
    const parts = objectSID.split('-');
    const rid = parseInt(parts[parts.length - 1], 10);
    return isNaN(rid) ? null : rid;
}

// ============================================================================
// USER ACCOUNT CONTROL FILTERING
// ============================================================================

const UAC_FLAGS = {
    SCRIPT: 0x0001,
    ACCOUNTDISABLE: 0x0002,
    HOMEDIR_REQUIRED: 0x0008,
    LOCKOUT: 0x0010,
    PASSWD_NOTREQD: 0x0020,
    PASSWD_CANT_CHANGE: 0x0040,
    ENCRYPTED_TEXT_PASSWORD_ALLOWED: 0x0080,
    TEMP_DUPLICATE_ACCOUNT: 0x0100,
    NORMAL_ACCOUNT: 0x0200,
    INTERDOMAIN_TRUST_ACCOUNT: 0x0800,
    WORKSTATION_TRUST_ACCOUNT: 0x1000,
    SERVER_TRUST_ACCOUNT: 0x2000,
    DONT_EXPIRE_PASSWD: 0x10000,
    MNS_LOGON_ACCOUNT: 0x20000,
    SMARTCARD_REQUIRED: 0x40000,
    TRUSTED_FOR_DELEGATION: 0x80000,
    NOT_DELEGATED: 0x100000,
    USE_DES_KEY_ONLY: 0x200000,
    DONT_REQUIRE_PREAUTH: 0x400000,
    PASSWORD_EXPIRED: 0x800000,
    TRUSTED_TO_AUTHENTICATE_FOR_DELEGATION: 0x1000000
};

function hasUACFlags(userAccountControl, flags) {
    if (!userAccountControl || flags.length === 0) return false;
    
    const uac = parseInt(userAccountControl, 10);
    if (isNaN(uac)) return false;
    
    return flags.some(flag => (uac & flag) !== 0);
}

function applyUACFilter() {
    const checkboxes = document.querySelectorAll('#uacFilterPanel input[type="checkbox"]:checked');
    const selectedFlags = Array.from(checkboxes).map(cb => parseInt(cb.value, 10));
    
    filterStates.uac.enabled = selectedFlags.length > 0;
    filterStates.uac.flags = selectedFlags;
    
    // Update status display
    const status = document.getElementById('uacFilterStatus');
    if (filterStates.uac.enabled) {
        const flagNames = Array.from(checkboxes).map(cb => cb.getAttribute('data-name'));
        status.textContent = `Active: ${flagNames.join(', ')}`;
        status.style.color = '#e74c3c';
    } else {
        status.textContent = 'No filters active';
        status.style.color = '#7f8c8d';
    }
    
    applyAllFilters();
}

function clearUACFilters() {
    const checkboxes = document.querySelectorAll('#uacFilterPanel input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    applyUACFilter();
}

// ============================================================================
// LDAP ATTRIBUTE FILTERING
// ============================================================================

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

function applyLDAPAttributeFilter() {
    const checkboxes = document.querySelectorAll('#ldapAttributePanel input[type="checkbox"]:checked');
    const selectedAttributes = Array.from(checkboxes).map(cb => ({
        attribute: cb.getAttribute('data-attribute'),
        value: cb.getAttribute('data-value') || null,
        name: cb.getAttribute('data-attribute')
    }));
    
    filterStates.ldapAttributes.enabled = selectedAttributes.length > 0;
    filterStates.ldapAttributes.attributes = selectedAttributes;
    
    // Update status display
    const status = document.getElementById('ldapAttributeFilterStatus');
    if (filterStates.ldapAttributes.enabled) {
        const attributeNames = selectedAttributes.map(attr => attr.attribute);
        status.textContent = `Active: ${attributeNames.join(', ')}`;
        status.style.color = '#e74c3c';
    } else {
        status.textContent = 'No filters active';
        status.style.color = '#7f8c8d';
    }
    
    applyAllFilters();
}

function clearLDAPAttributeFilters() {
    const checkboxes = document.querySelectorAll('#ldapAttributePanel input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    applyLDAPAttributeFilter();
}

// ============================================================================
// FILTER PANEL TOGGLE
// ============================================================================

function toggleFilterSection(panelId) {
    const panel = document.getElementById(panelId);
    const indicator = document.getElementById(panelId === 'uacFilterPanel' ? 'uacIndicator' : 'ldapIndicator');
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        indicator.textContent = '▼';
        indicator.classList.remove('collapsed');
    } else {
        panel.style.display = 'none';
        indicator.textContent = '▶';
        indicator.classList.add('collapsed');
    }
}

function toggleUACFilterPanel() {
    toggleFilterSection('uacFilterPanel');
}

function toggleLDAPAttributePanel() {
    toggleFilterSection('ldapAttributePanel');
}