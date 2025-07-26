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
        header.textContent = header.textContent.replace("▶", "▼");
    } else {
        elem.style.display = "none";
        header.textContent = header.textContent.replace("▼", "▶");
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
            if(header.textContent.indexOf("▶") !== -1) {
                header.textContent = header.textContent.replace("▶", "▼");
            }
        } else {
            if(header.textContent.indexOf("▼") !== -1) {
                header.textContent = header.textContent.replace("▼", "▶");
            }
        }
    }
}

// ============================================================================
// SEARCH AND FILTERING
// ============================================================================

let debounceTimer;

/**
 * Filters entries based on search input
 * Works in both detail and table views
 */
function filterEntries() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        let input = document.getElementById('searchInput').value.toLowerCase();
        if (currentView === 'detail') {
            let entries = document.getElementsByClassName('entry');
            for (let entry of entries) {
                let text = entry.innerText.toLowerCase();
                entry.style.display = text.includes(input) ? "" : "none";
            }
        } else {
            let rows = document.querySelectorAll("#tableView tbody tr");
            rows.forEach(row => {
                let text = row.innerText.toLowerCase();
                row.style.display = text.includes(input) ? "" : "none";
            });
        }
    }, 150);
}

// ============================================================================
// VIEW SWITCHING
// ============================================================================
// Toggle between detail view and table view

let currentView = 'detail';

/**
 * Switches between detail and table views
 * @param {string} view - Either 'detail' or 'table'
 */
function switchView(view) {
    currentView = view;
    const detailView = document.getElementById('detailView');
    const tableView = document.getElementById('tableView');
    if (view === 'detail') {
        detailView.classList.remove('hidden');
        tableView.classList.add('hidden');
    } else {
        detailView.classList.add('hidden');
        tableView.classList.remove('hidden');
    }

    // Reapply current filters after view switch
    filterEntries();
}

// ============================================================================
// CSV EXPORT FUNCTIONALITY
// ============================================================================
// Exports the current table view data to CSV format

function exportCSV() {
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

/**
 * Updates the visibility of detail view specific buttons
 * Hides expand/collapse buttons when in table view
 */
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

// Enhance switchView function to update button states
const _origSwitchView = switchView;
switchView = function(view) {
    _origSwitchView(view);
    updateDetailButtons();
};

// Initialize button states when page loads
document.addEventListener('DOMContentLoaded', updateDetailButtons);

// ============================================================================
// NON-DEFAULT OBJECTS FILTERING
// ============================================================================
// Functionality to show/hide default Windows objects based on RID values
// Objects with RID >= 1000 are considered non-default (custom objects)

function getRIDFromObjectSID(objectSID) {
    // objectSID attendu sous forme S-1-5-21-...-RID
    if (!objectSID) return null;
    const parts = objectSID.split('-');
    const rid = parseInt(parts[parts.length - 1], 10);
    return isNaN(rid) ? null : rid;
}

/**
 * Toggles visibility of default vs non-default objects
 */
let showNonDefaultOnly = false;
function toggleNonDefault() {
    showNonDefaultOnly = document.getElementById('nonDefaultCheckbox').checked;
    if (currentView === 'detail') {
        let entries = document.getElementsByClassName('entry');
        for (let entry of entries) {
            const objectSIDCell = Array.from(entry.getElementsByClassName('key'))
                .find(cell => cell.textContent === 'objectSid');
            let rid = null;
            if (objectSIDCell) {
                const valueCell = objectSIDCell.nextElementSibling;
                rid = getRIDFromObjectSID(valueCell ? valueCell.textContent : "");
            }
            if (!showNonDefaultOnly || (rid !== null && rid >= 1000)) {
                entry.style.display = "";
            } else {
                entry.style.display = "none";
            }
        }
    } else {
        let rows = document.querySelectorAll("#tableView tbody tr");
        let ths = document.querySelectorAll("#tableView thead th");
        let objectSIDIndex = Array.from(ths).findIndex(th => th.textContent === "objectSid");
        rows.forEach(row => {
            let rid = null;
            if (objectSIDIndex !== -1) {
                const cell = row.cells[objectSIDIndex];
                rid = getRIDFromObjectSID(cell ? cell.textContent : "");
            }
            if (!showNonDefaultOnly || (rid !== null && rid >= 1000)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    }
}

// ============================================================================
// USER ACCOUNT CONTROL FILTERING
// ============================================================================
// Generic functionality to filter accounts based on userAccountControl flags
// Allows filtering for various security-relevant account states

/**
 * UserAccountControl flag constants for Active Directory
 */
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

/**
 * Current UAC filter state
 */
let currentUACFilter = {
    enabled: false,
    flags: []
};

/**
 * Checks if userAccountControl has specific flags set
 * @param {string} userAccountControl - The userAccountControl value as string
 * @param {number[]} flags - Array of UAC flag values to check
 * @returns {boolean} True if any of the specified flags are set
 */
function hasUACFlags(userAccountControl, flags) {
    if (!userAccountControl || flags.length === 0) return false;
    
    const uac = parseInt(userAccountControl, 10);
    if (isNaN(uac)) return false;
    
    // Check if any of the specified flags are set
    return flags.some(flag => (uac & flag) !== 0);
}

/**
 * Applies UAC-based filtering to entries
 */
function applyUACFilter() {
    const checkboxes = document.querySelectorAll('#uacFilterPanel input[type="checkbox"]:checked');
    const selectedFlags = Array.from(checkboxes).map(cb => parseInt(cb.value, 10));
    
    currentUACFilter.enabled = selectedFlags.length > 0;
    currentUACFilter.flags = selectedFlags;
    
    // Update status display
    const status = document.getElementById('uacFilterStatus');
    if (currentUACFilter.enabled) {
        const flagNames = Array.from(checkboxes).map(cb => cb.getAttribute('data-name'));
        status.textContent = `Active: ${flagNames.join(', ')}`;
        status.style.color = '#e74c3c';
    } else {
        status.textContent = 'No filters active';
        status.style.color = '#7f8c8d';
    }
    
    // Apply filtering
    filterByUAC();
}

/**
 * Filters entries based on selected UAC flags
 */
function filterByUAC() {
    if (currentView === 'detail') {
        // Handle detail view filtering
        let entries = document.getElementsByClassName('entry');
        
        for (let entry of entries) {
            let shouldShow = true;
            
            if (currentUACFilter.enabled) {
                // Find userAccountControl in the attributes table
                const uacCell = Array.from(entry.getElementsByClassName('key'))
                    .find(cell => cell.textContent === 'userAccountControl');
                
                if (uacCell) {
                    const valueCell = uacCell.nextElementSibling;
                    const uacValue = valueCell ? valueCell.textContent : "";
                    shouldShow = hasUACFlags(uacValue, currentUACFilter.flags);
                } else {
                    shouldShow = false; // Hide entries without userAccountControl
                }
            }
            
            entry.style.display = shouldShow ? "" : "none";
        }
    } else {
        // Handle table view filtering
        let rows = document.querySelectorAll("#tableView tbody tr");
        let ths = document.querySelectorAll("#tableView thead th");
        
        // Find the userAccountControl column index
        let uacIndex = Array.from(ths).findIndex(th => th.textContent === "userAccountControl");
        
        rows.forEach(row => {
            let shouldShow = true;
            
            if (currentUACFilter.enabled) {
                if (uacIndex !== -1) {
                    const cell = row.cells[uacIndex];
                    const uacValue = cell ? cell.textContent : "";
                    shouldShow = hasUACFlags(uacValue, currentUACFilter.flags);
                } else {
                    shouldShow = false; // Hide entries without userAccountControl
                }
            }
            
            row.style.display = shouldShow ? "" : "none";
        });
    }
}

/**
 * Clears all UAC filters
 */
function clearUACFilters() {
    // Uncheck all checkboxes
    const checkboxes = document.querySelectorAll('#uacFilterPanel input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    
    // Apply the cleared filters
    applyUACFilter();
}

// ============================================================================
// LDAP ATTRIBUTE FILTERING
// ============================================================================
// Filtering based on presence/absence of specific LDAP attributes

let currentLDAPAttributeFilter = {
    enabled: false,
    attributes: []
};

/**
 * Checks if an entry has a specific LDAP attribute with optional value check
 * @param {Element} entry - The DOM entry element
 * @param {string} attributeName - The LDAP attribute name to check
 * @param {string|null} expectedValue - Optional specific value to match
 * @returns {boolean} True if attribute exists (and matches value if specified)
 */
function hasLDAPAttribute(entry, attributeName, expectedValue = null) {
    const attributeCell = Array.from(entry.getElementsByClassName('key'))
        .find(cell => cell.textContent === attributeName);
    
    if (!attributeCell) return false;
    
    const valueCell = attributeCell.nextElementSibling;
    if (!valueCell) return false;
    
    const attributeValue = valueCell.textContent.trim();
    
    // If no specific value expected, just check if attribute exists and is not empty
    if (expectedValue === null) {
        return attributeValue !== '';
    }
    
    // Check for specific value
    return attributeValue === expectedValue;
}

/**
 * Applies LDAP attribute-based filtering to entries
 */
function applyLDAPAttributeFilter() {
    const checkboxes = document.querySelectorAll('#ldapAttributePanel input[type="checkbox"]:checked');
    const selectedAttributes = Array.from(checkboxes).map(cb => ({
        attribute: cb.getAttribute('data-attribute'),
        value: cb.getAttribute('data-value') || null,
        name: cb.getAttribute('data-attribute')
    }));
    
    currentLDAPAttributeFilter.enabled = selectedAttributes.length > 0;
    currentLDAPAttributeFilter.attributes = selectedAttributes;
    
    // Update status display
    const status = document.getElementById('ldapAttributeFilterStatus');
    if (currentLDAPAttributeFilter.enabled) {
        const attributeNames = selectedAttributes.map(attr => attr.attribute);
        status.textContent = `Active: ${attributeNames.join(', ')}`;
        status.style.color = '#e74c3c';
    } else {
        status.textContent = 'No filters active';
        status.style.color = '#7f8c8d';
    }
    
    // Apply filtering
    filterByLDAPAttributes();
}

/**
 * Filters entries based on selected LDAP attributes
 */
function filterByLDAPAttributes() {
    if (currentView === 'detail') {
        // Handle detail view filtering
        let entries = document.getElementsByClassName('entry');
        
        for (let entry of entries) {
            let shouldShow = true;
            
            if (currentLDAPAttributeFilter.enabled) {
                // Entry must match ALL selected attribute filters (AND logic)
                shouldShow = currentLDAPAttributeFilter.attributes.every(attrFilter => 
                    hasLDAPAttribute(entry, attrFilter.attribute, attrFilter.value)
                );
            }
            
            entry.style.display = shouldShow ? "" : "none";
        }
    } else {
        // Handle table view filtering
        let rows = document.querySelectorAll("#tableView tbody tr");
        let ths = document.querySelectorAll("#tableView thead th");
        
        rows.forEach(row => {
            let shouldShow = true;
            
            if (currentLDAPAttributeFilter.enabled) {
                shouldShow = currentLDAPAttributeFilter.attributes.every(attrFilter => {
                    // Find the column index for this attribute
                    let attrIndex = Array.from(ths).findIndex(th => th.textContent === attrFilter.attribute);
                    
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
}

/**
 * Clears all LDAP attribute filters
 */
function clearLDAPAttributeFilters() {
    // Uncheck all checkboxes
    const checkboxes = document.querySelectorAll('#ldapAttributePanel input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    
    // Apply the cleared filters
    applyLDAPAttributeFilter();
}

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
