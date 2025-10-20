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
    const slider = document.querySelector('.theme-toggle .toggle-slider');
    const sliderIcon = document.querySelector('.theme-toggle .slider-icon');
    
    if (theme === 'dark') {
        slider.classList.add('active');
        sliderIcon.textContent = '🌙​';
    } else {
        slider.classList.remove('active');
        sliderIcon.textContent = '🔆';
    }
}

// ============================================================================
// DETAIL VIEW CONTROLS
// ============================================================================
// Functions for expanding/collapsing individual entries and bulk operations

/**
 * Toggles the visibility of a specific entry's attributes section
 * @param {string} id - The ID of the attributes container to toggle
 */
function toggle(id) {
    const elem = document.getElementById(id);
    const header = elem.previousElementSibling.querySelector('h2');
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
    const groupByBtn = document.getElementById('groupByBtn');
    const tableButtons = document.getElementById('tableButtons');
    
    if (currentView === 'detail') {
        expandBtn.style.display = '';
        collapseBtn.style.display = '';
        groupByBtn.style.display = '';
        tableButtons.style.display = 'none';
    } else if (currentView === 'table') {
        expandBtn.style.display = 'none';
        collapseBtn.style.display = 'none';
        groupByBtn.style.display = 'none';
        tableButtons.style.display = 'flex';
    } else {
        expandBtn.style.display = 'none';
        collapseBtn.style.display = 'none';
        groupByBtn.style.display = 'none';
        tableButtons.style.display = 'none';
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
    const statsView = document.getElementById('statsView');
    const detailButtons = document.getElementById('detailButtons');
    const tableButtons = document.getElementById('tableButtons');
    const activeButton = event ? event.target : null;
    const body = document.body;

    currentView = view;
    
    // Hide all views first
    detailView.classList.add('hidden');
    tableView.classList.add('hidden');
    statsView.classList.add('hidden');

    // Remove stats view class from body
    body.classList.remove('stats-view-active');
    
    if (view === 'detail') {
        detailView.classList.remove('hidden');
        detailButtons.style.display = 'flex';
        tableButtons.style.display = 'none';
        setActiveMenuButton(activeButton);
        // Re-apply all filters
        applyAllFilters();
    } else if (view === 'table') {
        tableView.classList.remove('hidden');
        detailButtons.style.display = 'none';
        tableButtons.style.display = 'flex';
        setActiveMenuButton(activeButton);
        // Re-apply all filters
        applyAllFilters();
    } else if (view === 'stats') {
        statsView.classList.remove('hidden');
        detailButtons.style.display = 'none';
        tableButtons.style.display = 'none';
        setActiveMenuButton(activeButton);
        // Add stats view class to body to hide search/filters
        body.classList.add('stats-view-active');
        // Statistics are pre-generated, no need to calculate
    }
}

// =============================================================================
// MINIMAL VIEW TOGGLE
// =============================================================================

function toggleMinimalView() {
    const body = document.body;
    const viewToggle = document.querySelector('.view-toggle');
    
    body.classList.toggle('minimal-view');
    viewToggle.classList.toggle('minimal');
    
    const isMinimal = body.classList.contains('minimal-view');
    
    // Update the toggle slider icon
    updateMinimalViewToggle(isMinimal);
}

function updateMinimalViewToggle(isMinimal) {
    const slider = document.querySelector('.view-toggle .toggle-slider');
    const sliderIcon = document.querySelector('.view-toggle .slider-icon-minimal');
    const button = document.querySelector('.view-toggle');
    
    if (isMinimal) {
        slider.classList.add('active'); // Slide to the right
        sliderIcon.textContent = '➖'; // Show minimal icon
        button.setAttribute('title', 'Toggle full view - Show all columns');
    } else {
        slider.classList.remove('active'); // Default position to the left
        sliderIcon.textContent = '➕'; // Show full icon (default)
        button.setAttribute('title', 'Toggle minimal view - Show only essential columns');

    }
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
    
    return flags.every(flagObj => {
        if (flagObj.inverse) {
            // We want the flag NOT to be present
            return (uac & flagObj.value) === 0;
        } else {
            // We want the flag to be present
            return (uac & flagObj.value) !== 0;
        }
    });
}

function hasLDAPAttribute(entry, attributeName, expectedValue = null) {
    // Special case for Kerberoastable (Has SPN)
    if (attributeName === 'servicePrincipalName' && expectedValue === null) {
        return isKerberoastable(entry);
    }

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

/**
 * Parse Active Directory date strings
 * @param {string} dateStr - The date string to parse
 * @returns {Date} - The parsed Date object
 */
function parseADDate(dateStr) {
  // If the string contains microseconds (.)
  if (dateStr.includes(".")) {
    // Ignore everything after the dot
    return new Date(dateStr.split(".")[0]);
  } else {
    // Remove the +00:00 (timezone) if present
    return new Date(dateStr.replace("+00:00", ""));
  }
}

/**
 * Check if the operating system is unsupported
 */
function hasUnsupportedOS(osValue) {
    if (!osValue) return false;
    const regex = /(2000|2003|2008|xp|vista|7|me)/i;
    return regex.test(osValue);
}

/**
 * Returns true if the entry is Kerberoastable:
 * - Has servicePrincipalName
 * - Is NOT disabled (ACCOUNTDISABLE flag absent)
 */
function isKerberoastable(entry) {
    // Get SPN value
    const spnCell = Array.from(entry.getElementsByClassName('key'))
        .find(cell => cell.textContent === 'servicePrincipalName');
    let hasSPN = false;
    if (spnCell) {
        const valueCell = spnCell.nextElementSibling;
        hasSPN = valueCell && valueCell.textContent.trim() !== '';
    }

    // Get UAC value
    const uacCell = Array.from(entry.getElementsByClassName('key'))
        .find(cell => cell.textContent === 'userAccountControl');
    let isDisabled = false;
    if (uacCell) {
        const valueCell = uacCell.nextElementSibling;
        const uacContainer = valueCell.querySelector('.uac-value');
        const uacValue = uacContainer ? uacContainer.textContent : valueCell.textContent;
        const uacInt = parseInt(uacValue, 10);
        isDisabled = !isNaN(uacInt) && (uacInt & 2) !== 0;
    }

    return hasSPN && !isDisabled;
}

// ============================================================================
// CORE FILTERING ENGINE
// ============================================================================
// Centralized filtering that applies all active filters together

let debounceTimer;
let currentView = 'detail';

// Filter states
let filterStates = {
    search: '',
    general: {
        enabled: false,
        generalFilter: null 
    },
    uac: {
        enabled: false,
        flags: []
    },
    ldapAttributes: {
        enabled: false,
        attributes: []
    }
};

// Function to apply general filters 
function applyGeneralFilter(entry, filterType) {
    if (!filterType) return true;
    const now = new Date();

    switch (filterType) {
        case 'default':
        case 'nonDefault': {
            // RID logic
            const objectSIDCell = Array.from(entry.getElementsByClassName('key'))
                .find(cell => cell.textContent === 'objectSid');
            let rid = null;
            if (objectSIDCell) {
                const valueCell = objectSIDCell.nextElementSibling;
                rid = getRIDFromObjectSID(valueCell ? valueCell.textContent : "");
            }
            if (filterType === 'default') return rid !== null && rid <= 1000;
            if (filterType === 'nonDefault') return rid !== null && rid > 1000;
            return true;
        }
        case 'recentlyCreated': {
            // whenCreated < 30 jours
            const cell = Array.from(entry.getElementsByClassName('key')).find(c => c.textContent === 'whenCreated');
            let whenCreated = null;
            if (cell) {
                const valueCell = cell.nextElementSibling;
                whenCreated = valueCell ? valueCell.textContent.trim() : null;
            }
            // If there is no whenCreated date, do not display the entry
            if (!whenCreated || whenCreated === '') {
                return false;
            }
            const createdDate = parseADDate(whenCreated);
            if (!createdDate) return false;
            const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
            return diffDays <= 30;
        }
        case 'inactiveAccounts': {
            // lastLogon > 90 jours
            const cell = Array.from(entry.getElementsByClassName('key')).find(c => c.textContent === 'lastLogon');
            let lastLogon = null;
            if (cell) {
                const valueCell = cell.nextElementSibling;
                lastLogon = valueCell ? valueCell.textContent.trim() : null;
            }
            // if there is no lastLogon or if it is the default AD date, do not display
            if (!lastLogon || lastLogon === '' || lastLogon === "1601-01-01 00:00:00+00:00") {
                return false;
            }
            const logonDate = parseADDate(lastLogon);
            const diffLogonDays = (now - logonDate) / (1000 * 60 * 60 * 24);
            return diffLogonDays > 90;
        }
        case 'neverLoggedIn': {
            // logonCount == 0
            const cell = Array.from(entry.getElementsByClassName('key')).find(c => c.textContent === 'logonCount');
            let logonCount = null;
            if (cell) {
                const valueCell = cell.nextElementSibling;
                logonCount = valueCell ? valueCell.textContent.trim() : null;
            }
            return logonCount === '0';
        }
        case 'owned':
            return entry.classList.contains('owned');
        case 'nonowned':
            return !entry.classList.contains('owned');
        default:
            return true;
    }
}

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
    let entries;
    
    if (isGroupedByGroups) {
        // In grouped view, filter entries within group sections
        entries = document.querySelectorAll('.group-entries .entry');
        
        // Also handle group sections visibility
        const groupSections = document.querySelectorAll('.group-section');
        groupSections.forEach(section => {
            const sectionEntries = section.querySelectorAll('.entry');
            let visibleCount = 0;
            
            sectionEntries.forEach(entry => {
                let shouldShow = true;
                
                // Apply search filter with improved text extraction
                if (filterStates.search && shouldShow) {
                    const searchableText = getSearchableText(entry);
                    shouldShow = searchableText.includes(filterStates.search);
                }

                // Apply general filter
                if (filterStates.general.enabled && shouldShow) {
                    shouldShow = applyGeneralFilter(entry, filterStates.general.generalFilter);
                }
                
                // Apply UAC filter
                if (filterStates.uac.enabled && shouldShow) {
                    const uacCell = Array.from(entry.getElementsByClassName('key'))
                        .find(cell => cell.textContent === 'userAccountControl');
                    
                    if (uacCell) {
                        const valueCell = uacCell.nextElementSibling;
                        // Handle both formatted UAC and raw values
                        const uacContainer = valueCell.querySelector('.uac-value');
                        const uacValue = uacContainer ? uacContainer.textContent : valueCell.textContent;
                        shouldShow = hasUACFlags(uacValue, filterStates.uac.flags);
                    } else {
                        shouldShow = false;
                    }
                }
                
                // Apply LDAP attributes filter
                if (filterStates.ldapAttributes.enabled && shouldShow) {
                    shouldShow = filterStates.ldapAttributes.attributes.every(attrFilter => {
                        if (attrFilter.unsupportedOS) {
                            // Cherche la valeur de operatingSystem
                            const osCell = Array.from(entry.getElementsByClassName('key')).find(cell => cell.textContent === 'operatingSystem');
                            const osValue = osCell ? osCell.nextElementSibling.textContent.trim() : "";
                            return hasUnsupportedOS(osValue);
                        } else {
                            return hasLDAPAttribute(entry, attrFilter.attribute, attrFilter.value);
                        }
                    });
                }
                
                entry.style.display = shouldShow ? "" : "none";
                if (shouldShow) visibleCount++;
            });
            
            // Hide group section if no visible entries
            section.style.display = visibleCount > 0 ? '' : 'none';
            
            // Update group count
            const countSpan = section.querySelector('.group-count');
            if (countSpan) {
                countSpan.textContent = `${visibleCount} user${visibleCount !== 1 ? 's' : ''}`;
            }
        });
    } else {
        // Normal view
        entries = document.getElementsByClassName('entry');
        
        for (let entry of entries) {
            let shouldShow = true;
            
            // Apply search filter with improved text extraction
            if (filterStates.search && shouldShow) {
                const searchableText = getSearchableText(entry);
                shouldShow = searchableText.includes(filterStates.search);
            }

            // Apply General Filter
            if (filterStates.general.enabled && shouldShow) {
                shouldShow = applyGeneralFilter(entry, filterStates.general.generalFilter);
            }
            
            // Apply UAC filter
            if (filterStates.uac.enabled && shouldShow) {
                const uacCell = Array.from(entry.getElementsByClassName('key'))
                    .find(cell => cell.textContent === 'userAccountControl');
                
                if (uacCell) {
                    const valueCell = uacCell.nextElementSibling;
                    // Handle both formatted UAC and raw values
                    const uacContainer = valueCell.querySelector('.uac-value');
                    const uacValue = uacContainer ? uacContainer.textContent : valueCell.textContent;
                    shouldShow = hasUACFlags(uacValue, filterStates.uac.flags);
                } else {
                    shouldShow = false;
                }
            }
            
            // Apply LDAP attributes filter
            if (filterStates.ldapAttributes.enabled && shouldShow) {
                shouldShow = filterStates.ldapAttributes.attributes.every(attrFilter => {
                    if (attrFilter.unsupportedOS) {
                        // Cherche la valeur de operatingSystem
                        const osCell = Array.from(entry.getElementsByClassName('key')).find(cell => cell.textContent === 'operatingSystem');
                        const osValue = osCell ? osCell.nextElementSibling.textContent.trim() : "";
                        return hasUnsupportedOS(osValue);
                    } else {
                        return hasLDAPAttribute(entry, attrFilter.attribute, attrFilter.value);
                    }
                });
            }
            
            entry.style.display = shouldShow ? "" : "none";
        }
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
    
    const whenCreatedIndex = Array.from(ths).findIndex(th => th.textContent === "whenCreated");
    const lastLogonIndex = Array.from(ths).findIndex(th => th.textContent === "lastLogon");
    const logonCountIndex = Array.from(ths).findIndex(th => th.textContent === "logonCount");
    
    rows.forEach(row => {
        let shouldShow = true;
        
        // Apply search filter with improved text extraction
        if (filterStates.search && shouldShow) {
            let searchableText = '';
            
            // Get text from all cells
            Array.from(row.cells).forEach(cell => {
                // Handle UAC cells specially
                if (cell.querySelector('.uac-container')) {
                    const uacValue = cell.querySelector('.uac-value');
                    if (uacValue) {
                        searchableText += uacValue.textContent.trim() + ' ';
                    }
                    const flags = cell.querySelectorAll('.uac-flag');
                    flags.forEach(flag => {
                        searchableText += flag.textContent.trim() + ' ';
                    });
                } else {
                    searchableText += cell.textContent.trim() + ' ';
                }
            });
            
            shouldShow = searchableText.toLowerCase().includes(filterStates.search);
        }

        if (filterStates.general.enabled && shouldShow) {
            const type = filterStates.general.generalFilter;
            const now = new Date();
            switch (type) {
                case 'default':
                case 'nonDefault': {
                    let rid = null;
                    if (objectSIDIndex !== -1) {
                        const cell = row.cells[objectSIDIndex];
                        rid = getRIDFromObjectSID(cell ? cell.textContent : "");
                    }
                    if (type === 'default') shouldShow = rid !== null && rid <= 1000;
                    if (type === 'nonDefault') shouldShow = rid !== null && rid > 1000;
                    break;
                }
                case 'recentlyCreated': {
                    let whenCreated = null;
                    if (whenCreatedIndex !== -1) {
                        const cell = row.cells[whenCreatedIndex];
                        whenCreated = cell ? cell.textContent.trim() : null;
                    }
                    const createdDate = parseADDate(whenCreated);
                    shouldShow = createdDate && ((now - createdDate) / (1000 * 60 * 60 * 24) <= 30);
                    break;
                }
                case 'inactiveAccounts': {
                    let lastLogon = null;
                    if (lastLogonIndex !== -1) {
                        const cell = row.cells[lastLogonIndex];
                        lastLogon = cell ? cell.textContent.trim() : null;
                    }
                    // Ignore "1601-01-01 00:00:00+00:00"
                    if (!lastLogon || lastLogon === "1601-01-01 00:00:00+00:00") {
                        shouldShow = false;
                        break;
                    }
                    const logonDate = parseADDate(lastLogon);
                    shouldShow = logonDate && ((now - logonDate) / (1000 * 60 * 60 * 24) > 90);
                    break;
                }
                case 'neverLoggedIn': {
                    let logonCount = null;
                    if (logonCountIndex !== -1) {
                        const cell = row.cells[logonCountIndex];
                        logonCount = cell ? cell.textContent.trim() : null;
                    }
                    shouldShow = logonCount === '0';
                    break;
                }
                default:
                    break;
            }
        }
        
        // Apply UAC filter
        if (filterStates.uac.enabled && shouldShow) {
            if (uacIndex !== -1) {
                const cell = row.cells[uacIndex];
                // Handle both formatted UAC and raw values
                const uacContainer = cell.querySelector('.uac-value');
                const uacValue = uacContainer ? uacContainer.textContent : cell.textContent;
                shouldShow = hasUACFlags(uacValue, filterStates.uac.flags);
            } else {
                shouldShow = false;
            }
        }
        
        // Apply LDAP attributes filter
        if (filterStates.ldapAttributes.enabled && shouldShow) {
            shouldShow = filterStates.ldapAttributes.attributes.every(attrFilter => {
                if (attrFilter.unsupportedOS) {
                    const ths = document.querySelectorAll("#tableView thead th");
                    const osIndex = Array.from(ths).findIndex(th => th.textContent === "operatingSystem");
                    if (osIndex !== -1) {
                        const cell = row.cells[osIndex];
                        const osValue = cell ? cell.textContent.trim() : "";
                        return hasUnsupportedOS(osValue);
                    }
                    return false;
                } else if (attrFilter.attribute === 'servicePrincipalName' && attrFilter.value === null) {
                    // Kerberoastable logic for table view
                    const spnIndex = Array.from(ths).findIndex(th => th.textContent === 'servicePrincipalName');
                    const uacIndex = Array.from(ths).findIndex(th => th.textContent === 'userAccountControl');
                    if (spnIndex !== -1 && uacIndex !== -1) {
                        const spnCell = row.cells[spnIndex];
                        const uacCell = row.cells[uacIndex];
                        const hasSPN = spnCell && spnCell.textContent.trim() !== '';
                        let isDisabled = false;
                        if (uacCell) {
                            const uacContainer = uacCell.querySelector('.uac-value');
                            const uacValue = uacContainer ? uacContainer.textContent : uacCell.textContent;
                            const uacInt = parseInt(uacValue, 10);
                            isDisabled = !isNaN(uacInt) && (uacInt & 2) !== 0;
                        }
                        return hasSPN && !isDisabled;
                    }
                    return false;
                } else {
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
                }
            });
        }
        
        row.style.display = shouldShow ? "" : "none";
    });
}

// Function to show/hide the clear button
function toggleClearButton() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    
    if (searchInput.value.length > 0) {
        clearBtn.classList.add('show');
    } else {
        clearBtn.classList.remove('show');
    }
}

// Function to clear the search
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    
    searchInput.value = '';
    clearBtn.classList.remove('show');
    searchInput.focus();
    
    // Clear search state immediately and apply filters
    filterStates.search = '';
    clearTimeout(debounceTimer);
    applyAllFilters();
}

/**
 * Improved search text extraction that handles HTML content
 */
function getSearchableText(element) {
    let searchText = '';
    
    // Get the display name from h2
    const h2 = element.querySelector('h2');
    if (h2) {
        // Extract text content, removing emoji and special chars for better matching
        searchText +=  h2.textContent.trim() + ' ';
    }
    
    // Get all attribute keys and values
    const keys = element.querySelectorAll('.key');
    const values = element.querySelectorAll('.value');
    
    keys.forEach(key => {
        searchText += key.textContent.trim() + ' ';
    });
    
    values.forEach(value => {
        // For UAC values, also include the raw numeric value
        if (value.querySelector('.uac-container')) {
            const uacValue = value.querySelector('.uac-value');
            if (uacValue) {
                searchText += uacValue.textContent.trim() + ' ';
            }
            // Also include flag names
            const flags = value.querySelectorAll('.uac-flag');
            flags.forEach(flag => {
                searchText += flag.textContent.trim() + ' ';
            });
        } else {
            searchText += value.textContent.trim() + ' ';
        }
    });
    
    // Get group chip text
    const groupChips = element.querySelectorAll('.group-chip');
    groupChips.forEach(chip => {
        searchText += chip.textContent.trim() + ' ';
    });
    
    return searchText.toLowerCase();
}


/**
 * Search filter with debouncing
 */
function filterEntries() {
    // Clear any existing timer
    clearTimeout(debounceTimer);
    
    // Get search value immediately for UI responsiveness
    const searchValue = document.getElementById('searchInput').value.toLowerCase().trim();
    
    // Update filter state immediately
    filterStates.search = searchValue;
    
    // Apply filters with a shorter debounce for better responsiveness
    debounceTimer = setTimeout(() => {
        applyAllFilters();
    }, 100); 
}

function updateResultsCount() {
    let total = 0, visibles = 0;
    if (currentView === 'detail') {
        if (isGroupedByGroups) {
            // Count unique users in grouped view
            const uniqueUsers = new Set();
            const entries = document.querySelectorAll('.group-entries .entry');
            
            entries.forEach(entry => {
                const h2Element = entry.querySelector('h2');
                const displayName = h2Element ? h2Element.textContent.trim() : 'Unknown';
                uniqueUsers.add(displayName);
                
                if (entry.style.display !== 'none') {
                    // Don't add to visibles here - we'll count unique visible users
                }
            });
            
            const visibleUniqueUsers = new Set();
            entries.forEach(entry => {
                if (entry.style.display !== 'none') {
                    const h2Element = entry.querySelector('h2');
                    const displayName = h2Element ? h2Element.textContent.trim() : 'Unknown';
                    visibleUniqueUsers.add(displayName);
                }
            });
            
            total = uniqueUsers.size;
            visibles = visibleUniqueUsers.size;
        } else {
            const entries = document.getElementsByClassName('entry');
            total = entries.length;
            visibles = Array.from(entries).filter(e => e.style.display !== 'none').length;
        }
    } else {
        const rows = document.querySelectorAll("#tableView tbody tr");
        total = rows.length;
        visibles = Array.from(rows).filter(r => r.style.display !== 'none').length;
    }
    const el = document.getElementById('resultsCount');
    if (el) el.textContent = `${visibles} result${visibles !== 1 ? 's' : ''} / ${total} object${total !== 1 ? 's' : ''}`;
}

// ============================================================================
// FILTER SPECIFIC LOGIC
// ============================================================================

function applyUACFilter() {
    const activeChips = document.querySelectorAll('#uacTab .filter-chip.active');
    const selectedFlags = Array.from(activeChips).map(chip => {
        return {
            value: parseInt(chip.dataset.value, 10),
            inverse: chip.dataset.inverse === "true"
        };
    });
    
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

function toggleGeneralFilter(element, filterType) {
    const isActive = element.classList.contains('active');
    
    // Disable all general filters first
    document.querySelectorAll('#generalTab .filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });

    // If the chip was not active, activate it
    if (!isActive) {
        element.classList.add('active');
        filterStates.general.enabled = true;
        filterStates.general.generalFilter = filterType;
    } else {
        // If it was active and clicked, deactivate it
        filterStates.general.enabled = false;
        filterStates.general.generalFilter = null;
    }
    
    updateActiveFilterChips();
    updateFilterCount();
    applyAllFilters();
}

function toggleUnsupportedOSFilter(element) {
    const isActive = element.classList.contains('active');
    if (!isActive) {
        element.classList.add('active');
        filterStates.ldapAttributes.enabled = true;
        // Add a special filter for Unsupported OS
        filterStates.ldapAttributes.attributes.push({
            attribute: 'operatingSystem',
            value: null,
            unsupportedOS: true
        });
    } else {
        element.classList.remove('active');
        // Remove the special filter
        filterStates.ldapAttributes.attributes = filterStates.ldapAttributes.attributes.filter(attr => !attr.unsupportedOS);
        // Disable if no more LDAP filters
        if (filterStates.ldapAttributes.attributes.length === 0) {
            filterStates.ldapAttributes.enabled = false;
        }
    }
    updateActiveFilterChips();
    updateFilterCount();
    applyAllFilters();
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
    
    // General filters (RID-based)
    const generalChips = document.querySelectorAll('#generalTab .filter-chip.active');
    generalChips.forEach(chip => {
        const chipElement = createActiveFilterChip(chip.textContent.trim(), 'general', chip);
        container.appendChild(chipElement);
    });
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
        document.querySelectorAll('#generalTab .filter-chip.active').forEach(chip => {
            chip.classList.remove('active');
        });
        filterStates.general.enabled = false;
        filterStates.general.generalFilter = null;
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
    filterStates.general.enabled = false;
    filterStates.general.generalFilter = null;

    updateActiveFilterChips();
    updateFilterCount();
    applyAllFilters();
    
    // Close dropdown
    toggleFilterDropdown();
}

// ============================================================================
// OWNED OBJECT & HIGH VALUE TARGETS FUNCTIONALITY
// ============================================================================

let contextMenu = null;

document.addEventListener('DOMContentLoaded', function() {
    // Create context menu
    createContextMenu();

    // Prevent default context menu
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

    // Hide context menu on click elsewhere
    document.addEventListener('click', function(e) {
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
    });
});

function createContextMenu() {
    contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    document.body.appendChild(contextMenu);
}

function updateContextMenuContent(entry) {
    const isOwned = entry.classList.contains('owned');
    const isHighValue = entry.classList.contains('high-value-target');

    contextMenu.innerHTML = `
        <div class="context-menu-item toggle-owned">
            <span class="menu-icon">${isOwned ? '🚫' : '👑'}</span>
            ${isOwned ? 'Unmark as Owned' : 'Mark as Owned'}
        </div>
        <div class="context-menu-item toggle-high-value">
            <span class="menu-icon">${isHighValue ? '🚫' : '💎'}</span>
            ${isHighValue ? 'Unmark as High Value' : 'Mark as High Value Target'}
        </div>
    `;

    // Reattach click event
    contextMenu.querySelector('.toggle-owned').addEventListener('click', function() {
        if (contextMenu.targetEntry) {
            toggleOwned(contextMenu.targetEntry);
        }
        contextMenu.style.display = 'none';
    });

    contextMenu.querySelector('.toggle-high-value').addEventListener('click', function() {
        if (contextMenu.targetEntry) {
            toggleHighValue(contextMenu.targetEntry);
        }
        contextMenu.style.display = 'none';
    });
}

function toggleOwned(entry) {
    entry.classList.toggle('owned');
    // Save the state in localStorage
    const entryId = entry.querySelector('.attributes').id;
    const ownedEntries = JSON.parse(localStorage.getItem('ownedEntries') || '[]');
    
    if (entry.classList.contains('owned')) {
        if (!ownedEntries.includes(entryId)) {
            ownedEntries.push(entryId);
        }
    } else {
        const index = ownedEntries.indexOf(entryId);
        if (index > -1) {
            ownedEntries.splice(index, 1);
        }
    }
    
    localStorage.setItem('ownedEntries', JSON.stringify(ownedEntries));
}

function toggleHighValue(entry) {
    entry.classList.toggle('high-value-target');
    
    // Gérer le badge
    const h2 = entry.querySelector('h2');
    let badge = h2.querySelector('.high-value-badge');
    
    if (entry.classList.contains('high-value-target')) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'high-value-badge';
            badge.innerHTML = '💎';
            h2.appendChild(badge);
        }
    } else if (badge) {
        badge.remove();
    }
    
    // Sauvegarder dans le localStorage
    const entryId = entry.querySelector('.attributes').id;
    const highValueEntries = JSON.parse(localStorage.getItem('highValueEntries') || '[]');
    
    if (entry.classList.contains('high-value-target')) {
        if (!highValueEntries.includes(entryId)) {
            highValueEntries.push(entryId);
        }
    } else {
        const index = highValueEntries.indexOf(entryId);
        if (index > -1) {
            highValueEntries.splice(index, 1);
        }
    }
    
    localStorage.setItem('highValueEntries', JSON.stringify(highValueEntries));
}

// Right click event listener on entry elements
document.addEventListener('contextmenu', function(e) {
    const entry = e.target.closest('.entry');
    if (entry) {
        e.preventDefault();
        updateContextMenuContent(entry);
        
        // Position the context menu
        contextMenu.style.display = 'block';
        
        // Use clientX/clientY for fixed positioning (relative to viewport)
        let x = e.clientX;
        let y = e.clientY;
        
        // Get menu dimensions after making it visible
        const menuRect = contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Adjust position if menu would go outside viewport
        if (x + menuRect.width > viewportWidth) {
            x = viewportWidth - menuRect.width - 10;
        }
        if (y + menuRect.height > viewportHeight) {
            y = viewportHeight - menuRect.height - 10;
        }
        
        // Ensure minimum distance from edges
        x = Math.max(10, x);
        y = Math.max(10, y);
        
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.targetEntry = entry;
    }
});

// Restore owned entries on load
function restoreOwnedEntries() {
    const ownedEntries = JSON.parse(localStorage.getItem('ownedEntries') || '[]');
    ownedEntries.forEach(id => {
        const entry = document.querySelector(`#${id}`);
        if (entry) {
            entry.closest('.entry').classList.add('owned');
        }
    });
}

function restoreHighValueTargets() {
    const highValueEntries = JSON.parse(localStorage.getItem('highValueEntries') || '[]');
    highValueEntries.forEach(id => {
        const entry = document.querySelector(`#${id}`);
        if (entry) {
            const entryParent = entry.closest('.entry');
            entryParent.classList.add('high-value-target');
            
            const h2 = entryParent.querySelector('h2');
            if (h2 && !h2.querySelector('.high-value-badge')) {
                const badge = document.createElement('span');
                badge.className = 'high-value-badge';
                badge.innerHTML = '💎';
                h2.appendChild(badge);
            }
        }
    });
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
// GROUP BY FUNCTIONALITY
// ============================================================================

let isGroupedByGroups = false;
let originalEntries = []; // Store original entries

/**
 * Toggle group by groups view
 */
function toggleUsersByGroups() {
    isGroupedByGroups = !isGroupedByGroups;
    const button = document.getElementById('groupByBtn');
    
    if (isGroupedByGroups) {
        // Store original entries before grouping
        storeOriginalEntries();
        applyGroupByGroups();
        button.textContent = '📋 Ungroup';
        button.classList.add('active');
    } else {
        removeGroupByGroups();
        button.textContent = '👥 Users by Group';
        button.classList.remove('active');
    }
}

/**
 * Store original entries before grouping
 */
function storeOriginalEntries() {
    const detailView = document.getElementById('detailView');
    originalEntries = Array.from(detailView.getElementsByClassName('entry')).map(entry => entry.cloneNode(true));
}

/**
 * Toggle collapse/expand for a group section
 */
function toggleGroupSection(headerElem) {
    const section = headerElem.parentElement;
    const entries = section.querySelector('.group-entries');
    if (!entries) return;
    const isCollapsed = entries.style.display === 'none';
    entries.style.display = isCollapsed ? '' : 'none';
    headerElem.classList.toggle('collapsed', !isCollapsed);
}

// Add event listener after creating groups
function enableGroupCollapse() {
    document.querySelectorAll('.group-header').forEach(header => {
        header.onclick = function(e) {
            // Évite de collapse si on clique sur un bouton à l'intérieur du header
            if (e.target.closest('button')) return;
            toggleGroupSection(header);
        };
    });
}

/**
 * Apply group by groups organization
 */
function applyGroupByGroups() {
    const detailView = document.getElementById('detailView');
    const entries = Array.from(document.getElementsByClassName('entry'));
    
    // Extract user data with their groups
    const usersData = entries.map(entry => {
        const userData = extractUserGroups(entry);
        userData.element = entry;
        return userData;
    });
    
    // Create grouped structure
    const groupedUsers = createGroupedStructure(usersData);
    
    // Clear detail view and rebuild with groups
    detailView.innerHTML = '';
    
    // Add ungrouped users first if any
    if (groupedUsers.ungrouped.length > 0) {
        const ungroupedSection = createGroupSection('📝 No Groups', groupedUsers.ungrouped);
        detailView.appendChild(ungroupedSection);
    }
    
    // Add grouped users
    Object.keys(groupedUsers.groups).sort().forEach(groupName => {
        const groupSection = createGroupSection(groupName, groupedUsers.groups[groupName]);
        detailView.appendChild(groupSection);
    });
    
    // Re-apply filters
    applyAllFilters();

    // Enable collapse/expand on group headers
    enableGroupCollapse();
}

/**
 * Remove group by groups organization (restore original view)
 */
function removeGroupByGroups() {
    const detailView = document.getElementById('detailView');
    
    // Clear and restore original entries
    detailView.innerHTML = '';
    
    originalEntries.forEach(entry => {
        // Clean up any group-specific classes
        entry.classList.remove('grouped-entry');
        detailView.appendChild(entry);
    });
    
    // Re-apply filters
    applyAllFilters();
}


/**
 * Extract user groups from entry element (same logic as extract_group_names in Python)
 */
function extractUserGroups(entryElement) {
    const groupNames = [];
    
    // Extract groups from memberOf attribute
    const memberOfCell = Array.from(entryElement.getElementsByClassName('key'))
        .find(cell => cell.textContent === 'memberOf');
    
    if (memberOfCell) {
        const valueCell = memberOfCell.nextElementSibling;
        if (valueCell && valueCell.textContent.trim()) {
            // Split by comma and process each memberOf entry
            const memberOfValues = valueCell.textContent.split(',').map(s => s.trim());
            
            memberOfValues.forEach(memberOfEntry => {
                if (memberOfEntry) {
                    // Split by comma and take the first part
                    const firstPart = memberOfEntry.split(',')[0].trim();
                    
                    if (firstPart.toUpperCase().startsWith('CN=')) {
                        // Extract group name after "CN="
                        const groupName = firstPart.substring(3).trim(); // Remove "CN=" prefix
                        
                        // Skip "Users" and "Builtin" groups
                        if (groupName && 
                            groupName !== "Users" && 
                            groupName !== "Builtin" && 
                            !groupNames.includes(groupName)) {
                            groupNames.push(groupName);
                        }
                    }
                }
            });
        }
    }
    
    // Primary group ID to name mapping (same as Python)
    const PRIMARY_GROUP_MAPPING = {
        512: "Domain Admins",
        513: "Domain Users", 
        514: "Domain Guests",
        515: "Domain Computers",
        516: "Domain Controllers",
        517: "Cert Publishers",
        518: "Schema Admins",
        519: "Enterprise Admins",
        520: "Group Policy Creator Owners",
        521: "Read-only Domain Controllers",
        522: "Cloneable Domain Controllers",
        525: "Protected Users",
        526: "Key Admins",
        527: "Enterprise Key Admins"
    };
    
    // Add primary group (usually "Domain Users" for standard users)
    // The primary group is determined by primaryGroupID attribute
    const primaryGroupCell = Array.from(entryElement.getElementsByClassName('key'))
        .find(cell => cell.textContent === 'primaryGroupID');
    
    if (primaryGroupCell) {
        const valueCell = primaryGroupCell.nextElementSibling;
        if (valueCell && valueCell.textContent.trim()) {
            try {
                const groupId = parseInt(valueCell.textContent.trim(), 10);
                const primaryGroupName = PRIMARY_GROUP_MAPPING[groupId] || `Primary Group (${groupId})`;
                
                // Skip "Users" and "Builtin" groups, add primary group if not already in the list
                if (primaryGroupName !== "Users" && 
                    primaryGroupName !== "Builtin" && 
                    !groupNames.includes(primaryGroupName)) {
                    groupNames.push(primaryGroupName);
                }
            } catch (e) {
                console.warn(`Invalid primaryGroupID value: ${valueCell.textContent.trim()}`);
            }
        }
    }
    
    // Get user display name
    const h2Element = entryElement.querySelector('h2');
    const displayName = h2Element ? h2Element.textContent.trim() : 'Unknown User';
    
    return {
        displayName: displayName,
        groups: groupNames,
        element: entryElement
    };
}

/**
 * Create grouped structure from users data
 */
function createGroupedStructure(usersData) {
    const result = {
        groups: {},
        ungrouped: []
    };
    
    usersData.forEach(userData => {
        if (userData.groups.length === 0) {
            result.ungrouped.push(userData);
        } else {
            userData.groups.forEach(groupName => {
                if (!result.groups[groupName]) {
                    result.groups[groupName] = [];
                }
                // Avoid duplicates in the same group
                if (!result.groups[groupName].find(u => u.displayName === userData.displayName)) {
                    result.groups[groupName].push(userData);
                }
            });
        }
    });
    
    return result;
}

/**
 * Create a group section with title and users
 */
function createGroupSection(groupName, users) {
    const section = document.createElement('div');
    section.className = 'group-section';
    
    // Group header
    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
        <h3 class="group-title">${groupName}</h3>
        <span class="group-count">${users.length} user${users.length !== 1 ? 's' : ''}</span>
    `;
    section.appendChild(header);
    
    // Group container for entries
    const container = document.createElement('div');
    container.className = 'group-entries';
    
    users.forEach((userData, index) => {
        const entryClone = userData.element.cloneNode(true);
        entryClone.classList.add('grouped-entry');
        
        // Generate unique IDs for this group section to avoid conflicts
        const uniqueId = `${groupName.replace(/\s+/g, '_')}_${index}`;
        const attributesDiv = entryClone.querySelector('.attributes');
        if (attributesDiv) {
            attributesDiv.id = `attr_${uniqueId}`;
        }
        
        // Update onclick handler to use new unique ID
        const headerDiv = entryClone.querySelector('.entry-header');
        if (headerDiv) {
            headerDiv.setAttribute('onclick', `toggle('attr_${uniqueId}')`);
        }
        
        container.appendChild(entryClone);
    });
    
    section.appendChild(container);
    return section;
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
    
    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        toggleClearButton();
    }

    // Initialize UI state
    updateDetailButtons();
    updateResultsCount();
    updateFilterCount();

    // Restore owned entries
    restoreOwnedEntries();

    // Restore high value targets
    restoreHighValueTargets();
});


