#!/usr/bin/env python3

import json
import sys
import os
import argparse

# ============================================================================
# UAC FLAGS DEFINITION
# ============================================================================
# User Account Control flags mapping with severity and descriptions

def load_uac_flags():
    """
    Load UAC flags from external JSON file
    
    Returns:
        dict: UAC flags mapping with integer keys
    """
    base_dir = os.path.dirname(os.path.realpath(__file__))
    uac_file = os.path.join(base_dir, "uac_flags.json")
    
    # Default minimal flags for fallback
    default_flags = {
        0x0200: {"name": "NORMAL_ACCOUNT", "severity": "info", "description": "Standard user account"},
        0x0002: {"name": "ACCOUNTDISABLE", "severity": "critical", "description": "User account is disabled"},
        0x10000: {"name": "DONT_EXPIRE_PASSWORD", "severity": "warning", "description": "Password never expires"}
    }

    try:
        with open(uac_file, "r", encoding="utf-8") as f:
            uac_data = json.load(f)
        
        # Convert hex string keys to integers
        uac_flags = {}
        for hex_key, flag_info in uac_data.items():
            int_key = int(hex_key, 16)
            uac_flags[int_key] = flag_info
        
        return uac_flags
    except FileNotFoundError:
        print(f"[!] Warning: UAC flags file '{uac_file}' not found. Using default flags.")
        return default_flags
    except json.JSONDecodeError:
        print(f"[!] Warning: Invalid JSON in UAC flags file. Using default flags.")
        return default_flags

# Load UAC flags from JSON file or use defaults
UAC_FLAGS = load_uac_flags()

def get_combined_uac_flags(uac_value, uac_flags):
    """
    Returns a list of combined UAC flags that should be set based on the value.
    """
    combined_flags = []
    # PRE_CREATED_COMPUTER_ACCOUNT: PASSWD_NOTREQD (0x20) + WORKSTATION_TRUST_ACCOUNT (0x1000)
    if (uac_value & 0x20) and (uac_value & 0x1000):
        pre_created_flag = uac_flags.get(0x1020)
        if pre_created_flag:
            combined_flags.append(pre_created_flag)
    
    return combined_flags

def decode_uac_flags(uac_value):
    """
    Decode UAC flags from integer value
    
    Args:
        uac_value: Integer value of userAccountControl
        
    Returns:
        list: List of dictionaries with flag information
    """
    if not isinstance(uac_value, int):
        try:
            uac_value = int(uac_value)
        except (ValueError, TypeError):
            return []
    
    active_flags = []
    for flag_value, flag_info in UAC_FLAGS.items():
        # Skip combined flags, handled separately
        if flag_info["name"] == "PRE_CREATED_COMPUTER_ACCOUNT":
            continue
        if uac_value & flag_value:
            active_flags.append(flag_info)

    # Add combined flags
    active_flags.extend(get_combined_uac_flags(uac_value, UAC_FLAGS))
    return active_flags

def format_uac_display_html(uac_value, flags):
    """
    Format UAC value with flags for HTML display with enhanced styling
    
    Args:
        uac_value: Original UAC value
        flags: List of flag dictionaries
        
    Returns:
        str: Formatted HTML string with enhanced UAC display
    """
    if not flags:
        return f'<span class="uac-value">{uac_value}</span>'
    
    # Build flags HTML
    flags_html = ""
    for flag in flags:
        name = flag["name"]
        severity = flag["severity"]
        description = flag["description"]
        flags_html += f'<span class="uac-flag {severity}" data-flag="{name}" data-description="{description}">{name}</span>'
    
    return f'''
    <div class="uac-container">
        <div class="uac-value">{uac_value}</div>
        <div class="uac-flags-grid">
            {flags_html}
        </div>
    </div>
    '''

def getRIDFromObjectSID(objectSID):
    """
    Extract RID (Relative Identifier) from objectSID
    
    Args:
        objectSID: objectSID value (string format like "S-1-5-21-...")
        
    Returns:
        int: RID value or None if invalid
    """
    try:
        if isinstance(objectSID, str) and objectSID.startswith('S-'):
            # Split SID by dashes and get the last part (RID)
            parts = objectSID.split('-')
            if len(parts) >= 4:
                return int(parts[-1])
    except (ValueError, AttributeError, IndexError):
        pass
    return None

# ============================================================================
# LDAP DATA PROCESSING UTILITIES
# ============================================================================
# Helper functions to extract and process LDAP entry data

def extract_display_name(attributes, dn):
    """
    Extract best display name from LDAP entry attributes or DN
    
    Args:
        attributes (dict): LDAP entry attributes
        dn (str): Distinguished Name
        
    Returns:
        str: Display name (prefer sAMAccountName, fallback to CN, then DN)
    """
    # Priority 1 : sAMAccountName
    sam = attributes.get("sAMAccountName", [])
    if sam:
        return sam[0]

    # Priority 2 : CN
    cn = attributes.get("cn", [])
    if cn:
        return cn[0]

    # Priority 3 : DN fallback
    if dn and dn.upper().startswith('CN='):
        return dn.split(',')[0][3:]
    return dn
   
def extract_group_names(memberof_values, attributes):
    """
    Extract group names from memberOf attribute values and primary group
    
    Args:
        memberof_values (list): List of memberOf DN strings
        attributes (dict): All LDAP attributes (to get primary group info)
        
    Returns:
        list: List of clean group names including primary group
    """
    group_names = []
    
    # Extract groups from memberOf attribute
    if memberof_values:
        for memberof_entry in memberof_values:
            if isinstance(memberof_entry, str):    
                # Split by comma and take the first part
                first_part = memberof_entry.split(',')[0].strip()
                
                if first_part.upper().startswith('CN='):
                    # Extract group name after "CN="
                    group_name = first_part[3:].strip()  # Remove "CN=" prefix
                    
                    if group_name and group_name not in group_names:
                        group_names.append(group_name)
    
   
    # Primary group ID to name mapping
    PRIMARY_GROUP_MAPPING = {
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
    }

    # Add primary group (usually "Domain Users" for standard users)
    # The primary group is determined by primaryGroupID attribute
    primary_group_id = attributes.get("primaryGroupID", [])
    if primary_group_id:
        try:
            group_id = int(primary_group_id[0])
            primary_group_name = PRIMARY_GROUP_MAPPING.get(group_id, f"Primary Group ({group_id})")
            
            # Add primary group if not already in the list
            if primary_group_name not in group_names:
                group_names.append(primary_group_name)
                
        except (ValueError, TypeError, IndexError):
            pass
    
    return group_names

def gather_all_keys(data: list) -> list:
    """
    Collects all unique attribute keys from all LDAP entries
    
    Args:
        data (list): List of LDAP entry dictionaries
        
    Returns:
        list: Sorted list of all unique attribute names found across all entries
    """
    keys = set()
    for entry in data:
        attributes = entry.get("attributes", {})
        keys.update(attributes.keys())
    return sorted(keys)

def is_kerberoastable(attributes):
    """
    Returns True if the user is kerberoastable (has servicePrincipalName).
    """
    spn_values = attributes.get("servicePrincipalName", [])
    uac_values = attributes.get("userAccountControl", [])
    if not spn_values:
        return False
    if uac_values:
        try:
            uac_value = int(uac_values[0])
            # ACCOUNTDISABLE flag is 0x0002
            if uac_value & 0x0002:
                return False
        except (ValueError, TypeError):
            pass
    return True


# ============================================================================
# STATISTICS CALCULATION FUNCTIONS
# ============================================================================
# Functions to calculate statistics from LDAP data

from datetime import datetime, timedelta

def parse_ad_date(date_str):
    """
    Convert Windows FileTime to Python datetime
    """
    if '.' in date_str:
        # Handle microseconds
        return datetime.fromisoformat(date_str.split('.')[0])
    else:
        return datetime.fromisoformat(date_str.replace('+00:00', ''))
    
def calculate_ldap_statistics(data):
    """
    Calculate comprehensive statistics from LDAP data
    
    Args:
        data (list): List of LDAP entry dictionaries
        
    Returns:
        dict: Dictionary containing all calculated statistics
    """
    from datetime import datetime, timedelta, timezone
    
    total_objects = len(data)
    stats = {
        'global': {
            'totalObjects': total_objects,
            'recentlyCreated': 0,
            'defaultObjects': 0,        # RID <= 1000
            'nonDefaultObjects': 0,     # RID > 1000
            'inactiveAccounts': 0,      # lastLogon > 90 days
            'neverLoggedIn': 0          # logonCount == 0
        },
        'uac': {
            # Security Critical
            'disabledAccounts': 0,
            'noKerberosPreAuth': 0,
            'trustedForDelegation': 0,
            'constrainedDelegation': 0,
            'notDelegated': 0,
            # Password Related
            'passwordNotRequired': 0,
            'passwordNeverExpires': 0,
            'passwordCantChange': 0,
            'passwordExpired': 0,
            # Authentication & Access
            'smartcardRequired': 0,
            'accountLocked': 0,
            'reversibleEncryption': 0,
            'useDESKey': 0
        },
        'ldap': {
            # Security Critical Attributes
            'spnUsers': 0,
            'adminCountUsers': 0,
            'constrainedDelegationTarget': 0,
            'resourceBasedConstrainedDelegation': 0,
            # Information Disclosure
            'hasDescription': 0,
            'unsupportedOS': 0,
        },
        'groups': {},
        'uacStats': {},
        'objectTypes': {},
        'osDistribution': {}
    }
    
    # Date for recent accounts (30 days ago)
    thirty_days_ago = datetime.now() - timedelta(days=30)
    ninety_days_ago = datetime.now() - timedelta(days=90)
    
    for entry in data:
        attributes = entry.get("attributes", {})
        
        ### Global Statistics -------------------------------------------------------------------------

        # RID-based statistics (Default vs Non-default objects)
        object_sid = attributes.get("objectSid", [])
        if object_sid:
            try:
                rid = getRIDFromObjectSID(object_sid[0])
                if rid is not None:
                    if rid <= 1000:
                        stats['global']['defaultObjects'] += 1
                    else:
                        stats['global']['nonDefaultObjects'] += 1
            except (ValueError, TypeError, IndexError):
                pass
        
        # Recently created check
        when_created = attributes.get("whenCreated", [])
        if when_created:
            try:
                # Parse date - handle different formats
                date_str = when_created[0]
                created_date = parse_ad_date(date_str)
                if created_date > thirty_days_ago:
                    stats['global']['recentlyCreated'] += 1
            except (ValueError, TypeError):
                pass

        # Inactive Accounts (lastLogon > 90 jours)
        last_logon = attributes.get("lastLogon", [])
        if last_logon:
            try:
                last_logon_str = last_logon[0]
                if last_logon_str != "1601-01-01 00:00:00+00:00":
                    logon_time = parse_ad_date(last_logon_str)
                    if logon_time and logon_time < ninety_days_ago:
                        stats['global']['inactiveAccounts'] += 1
            except (ValueError, TypeError):
                pass

        # Accounts never logged in (logonCount == 0)
        logon_count = attributes.get("logonCount", [])
        if logon_count:
            try:
                if int(logon_count[0]) == 0:
                    stats['global']['neverLoggedIn'] += 1
            except Exception:
                pass
        

        ### UAC Statistics using UAC_FLAGS -------------------------------------------------------------------------
        uac_values = attributes.get("userAccountControl", [])
        if uac_values:
            try:
                uac_value = int(uac_values[0])
                
                # Security Critical
                if uac_value & 0x0002:  # ACCOUNTDISABLE
                    stats['uac']['disabledAccounts'] += 1
                if uac_value & 0x400000:  # DONT_REQ_PREAUTH
                    stats['uac']['noKerberosPreAuth'] += 1
                if uac_value & 0x80000:  # TRUSTED_FOR_DELEGATION
                    stats['uac']['trustedForDelegation'] += 1
                if uac_value & 0x1000000:  # TRUSTED_TO_AUTH_FOR_DELEGATION
                    stats['uac']['constrainedDelegation'] += 1
                if uac_value & 0x100000:  # NOT_DELEGATED
                    stats['uac']['notDelegated'] += 1
                
                # Password Related
                if uac_value & 0x0020:  # PASSWD_NOTREQD
                    stats['uac']['passwordNotRequired'] += 1
                if uac_value & 0x10000:  # DONT_EXPIRE_PASSWORD
                    stats['uac']['passwordNeverExpires'] += 1
                if uac_value & 0x0040:  # PASSWD_CANT_CHANGE
                    stats['uac']['passwordCantChange'] += 1
                if uac_value & 0x800000:  # PASSWORD_EXPIRED
                    stats['uac']['passwordExpired'] += 1
                
                # Authentication & Access
                if uac_value & 0x40000:  # SMARTCARD_REQUIRED
                    stats['uac']['smartcardRequired'] += 1
                if uac_value & 0x0010:  # LOCKOUT
                    stats['uac']['accountLocked'] += 1
                if uac_value & 0x0080:  # ENCRYPTED_TEXT_PWD_ALLOWED
                    stats['uac']['reversibleEncryption'] += 1
                if uac_value & 0x200000:  # USE_DES_KEY_ONLY
                    stats['uac']['useDESKey'] += 1
                
                # Count all UAC flags for detailed stats using UAC_FLAGS
                for flag_value, flag_info in UAC_FLAGS.items():
                    if uac_value & flag_value:
                        flag_name = flag_info["name"]

                        # Special case for PRE_CREATED_COMPUTER_ACCOUNT
                        if flag_name == "PRE_CREATED_COMPUTER_ACCOUNT":
                            # Only count if both PASSWD_NOTREQD (0x20) and WORKSTATION_TRUST_ACCOUNT (0x1000) are present
                            if (uac_value & 0x0020) and (uac_value & 0x1000):
                                stats['uacStats'][flag_name] = stats['uacStats'].get(flag_name, 0) + 1
                        else:
                            # Regular flag checking
                            if uac_value & flag_value:
                                stats['uacStats'][flag_name] = stats['uacStats'].get(flag_name, 0) + 1
                        
            except (ValueError, TypeError):
                pass
        
        ### LDAP Statistics -------------------------------------------------------------------------
        
        # AdminCount check
        admin_count = attributes.get("adminCount", [])
        if admin_count:
            try:
                if int(admin_count[0]) == 1:
                    stats['ldap']['adminCountUsers'] += 1
            except (ValueError, TypeError):
                pass
        
        # SPN check (Is Kerberoastable)
        if is_kerberoastable(attributes):
            stats['ldap']['spnUsers'] += 1
        
        # Constrained Delegation Target check
        constrained_delegation = attributes.get("msDS-AllowedToDelegateTo", [])
        if constrained_delegation and len(constrained_delegation) > 0:
            stats['ldap']['constrainedDelegationTarget'] += 1
            
        # RBCD - Resource-Based Constrained Delegation check
        rbcd_delegation = attributes.get("msDS-AllowedToActOnBehalfOfOtherIdentity", [])
        if rbcd_delegation and len(rbcd_delegation) > 0:
            stats['ldap']['resourceBasedConstrainedDelegation'] += 1
        
        ## OS Distribution + Unsupported OS stats
        os_name = attributes.get("operatingSystem", [""])[0]
        if os_name:
            os_key = os_name.strip()
            stats['osDistribution'][os_key] = stats['osDistribution'].get(os_key, 0) + 1
            # Check for unsupported OS
            if any(x in os_key.lower() for x in ["2000", "2003", "2008", "xp", "vista", "7", "me"]):
                stats['ldap']['unsupportedOS'] += 1

        # Has Description check
        description = attributes.get("description", [])
        if description and any(desc.strip() for desc in description):
            stats['ldap']['hasDescription'] += 1


        ### OTHER STATS -------------------------------------------------------------------------

        ## Object type classification
        object_class = attributes.get("objectClass", [])
        if object_class:
            # Take the most specific class (usually the last one)
            main_class = object_class[-1] if isinstance(object_class, list) else str(object_class)
            stats['objectTypes'][main_class] = stats['objectTypes'].get(main_class, 0) + 1

        ## Group statistics
        memberof_values = attributes.get("memberOf", [])
        group_names = extract_group_names(memberof_values, attributes)
        
        for group_name in group_names:
            stats['groups'][group_name] = stats['groups'].get(group_name, 0) + 1

    return stats

def render_statistics_html(stats, is_computers_file=False):
    """
    Render statistics as HTML for the dashboard
    
    Args:
        stats (dict): Statistics dictionary from calculate_ldap_statistics
        
    Returns:
        str: HTML string for the statistics dashboard
    """
    # Sort groups by member count (descending)
    sorted_groups = sorted(stats['groups'].items(), key=lambda x: x[1], reverse=True)
    
    # Sort UAC flags by count (descending) 
    sorted_uac_stats = sorted(stats['uacStats'].items(), key=lambda x: x[1], reverse=True)
    
    # Sort object types by count (descending)
    sorted_object_types = sorted(stats['objectTypes'].items(), key=lambda x: x[1], reverse=True)
    
    # Generate groups HTML
    groups_html = ""
    if sorted_groups:
        max_group_count = sorted_groups[0][1]
        for group_name, count in sorted_groups:
            width_percent = (count / max_group_count) * 100
            groups_html += f'''
                <div class="group-stat-item">
                    <span class="group-name">{group_name}</span>
                    <div class="group-bar-container">
                        <div class="group-bar" style="width: {width_percent}%"></div>
                        <span class="group-count">{count}</span>
                    </div>
                </div>'''
    
    # Generate UAC flags HTML
    uac_html = ""
    if sorted_uac_stats:
        max_uac_count = sorted_uac_stats[0][1]
        for flag_name, count in sorted_uac_stats:
            width_percent = (count / max_uac_count) * 100
            uac_html += f'''
                <div class="uac-stat-item">
                    <span class="uac-flag-name">{flag_name}</span>
                    <div class="uac-bar-container">
                        <div class="uac-bar" style="width: {width_percent}%"></div>
                        <span class="uac-count">{count}</span>
                    </div>
                </div>'''
    
    # Generate object types HTML
    object_types_html = ""
    if sorted_object_types:
        max_type_count = sorted_object_types[0][1]
        for obj_type, count in sorted_object_types:
            width_percent = (count / max_type_count) * 100
            object_types_html += f'''
                <div class="group-stat-item">
                    <span class="group-name">{obj_type}</span>
                    <div class="group-bar-container">
                        <div class="group-bar" style="width: {width_percent}%"></div>
                        <span class="group-count">{count}</span>
                    </div>
                </div>'''
    
    # Generate OS Distribution
    os_html = ""
    if stats['osDistribution']:
        sorted_os = sorted(stats['osDistribution'].items(), key=lambda x: x[1], reverse=True)
        max_os_count = sorted_os[0][1] if sorted_os else 1
        os_html += '''
            <div class="stats-section">
                <h3>🖥️ Operating System Distribution</h3>
                <div class="groups-list">
            '''
        
        for os_key, count in sorted_os:
            width_percent = (count / max_os_count) * 100
            os_html += f'''
                <div class="os-stat-item">
                    <span class="os-name">{os_key}</span>
                    <div class="os-bar-container">
                        <div class="os-bar" style="width: {width_percent}%"></div>
                        <span class="os-count">{count}</span>
                    </div>
                </div>
            '''
            
        os_html += '</div></div>'

    html = f'''
        <div class="dashboard-container">
            <div class="dashboard-header">
                <h2>📈 LDAP Statistics Dashboard</h2>
                <p class="dashboard-subtitle">Comprehensive analysis of LDAP directory objects</p>
            </div>
            
            <div class="stats-grid">
                <!-- Global Statistics -->
                <div class="stats-section">
                    <h3>🌐 Global Statistics</h3>
                    <div class="stats-cards">
                        <div class="stat-card total">
                            <div class="stat-value">{stats['global']['totalObjects']}</div>
                            <div class="stat-label">Total Objects</div>
                        </div>
                        <div class="stat-card info">
                            <div class="stat-value">{stats['global']['defaultObjects']}</div>
                            <div class="stat-label">🏛️ Default Objects (RID ≤ 1000)</div>
                        </div>
                        <div class="stat-card info">
                            <div class="stat-value">{stats['global']['nonDefaultObjects']}</div>
                            <div class="stat-label">🛠️ Non-default Objects (RID > 1000)</div>
                        </div>
                        <div class="stat-card info">
                            <div class="stat-value">{stats['global']['recentlyCreated']}</div>
                            <div class="stat-label">🕒 Recently Created (30d)</div>
                        </div>
                        <div class="stat-card warning">
                            <div class="stat-value">{stats['global']['inactiveAccounts']}</div>
                            <div class="stat-label">💤 Inactive Accounts (lastLogon>90d)</div>
                        </div>
                        <div class="stat-card warning">
                            <div class="stat-value">{stats['global']['neverLoggedIn']}</div>
                            <div class="stat-label">❌ Never Logged In (logonCount=0)</div>
                        </div>
                    </div>
                </div>
                
                <!-- UAC Statistics -->
                <div class="stats-section uac-stats-section">
                    <h3>🛡️ UAC Statistics</h3>
                    
                    <!-- Security Critical Section -->
                    <div class="uac-subsection">
                        <h4>🚨 Security Critical</h4>
                        <div class="uac-compact-grid">
                            <div class="uac-compact-item warning">
                                <span class="uac-compact-value">{stats['uac']['disabledAccounts']}</span>
                                <span class="uac-compact-label">🚫 Account Disabled</span>
                            </div>
                            <div class="uac-compact-item critical">
                                <span class="uac-compact-value">{stats['uac']['noKerberosPreAuth']}</span>
                                <span class="uac-compact-label">🔑 No Kerberos PreAuth</span>
                            </div>
                            <div class="uac-compact-item critical">
                                <span class="uac-compact-value">{stats['uac']['trustedForDelegation']}</span>
                                <span class="uac-compact-label">🎭🚀 Unconstrained Delegation (KUD)</span>
                            </div>
                            <div class="uac-compact-item warning">
                                <span class="uac-compact-value">{stats['uac']['constrainedDelegation']}</span>
                                <span class="uac-compact-label">🎭📌 Constrained Delegation (KCD w/ Protocol Transition)</span>
                            </div>
                            <div class="uac-compact-item warning">
                                <span class="uac-compact-value">{stats['uac']['notDelegated']}</span>
                                <span class="uac-compact-label">🛡️ Cannot Be Delegated</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Password Related Section -->
                    <div class="uac-subsection">
                        <h4>🔐 Password Related</h4>
                        <div class="uac-compact-grid">
                            <div class="uac-compact-item critical">
                                <span class="uac-compact-value">{stats['uac']['passwordNotRequired']}</span>
                                <span class="uac-compact-label">🔓 Password Not Required</span>
                            </div>
                            <div class="uac-compact-item warning">
                                <span class="uac-compact-value">{stats['uac']['passwordNeverExpires']}</span>
                                <span class="uac-compact-label">⏰ Password Never Expires</span>
                            </div>
                            <div class="uac-compact-item warning">
                                <span class="uac-compact-value">{stats['uac']['passwordCantChange']}</span>
                                <span class="uac-compact-label">🔒 User Cannot Change Password</span>
                            </div>
                            <div class="uac-compact-item info">
                                <span class="uac-compact-value">{stats['uac']['passwordExpired']}</span>
                                <span class="uac-compact-label">⚠️ Password Expired</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Authentication & Access Section -->
                    <div class="uac-subsection">
                        <h4>🔑 Authentication & Access</h4>
                        <div class="uac-compact-grid">
                            <div class="uac-compact-item info">
                                <span class="uac-compact-value">{stats['uac']['smartcardRequired']}</span>
                                <span class="uac-compact-label">💳 Smartcard Required</span>
                            </div>
                            <div class="uac-compact-item info">
                                <span class="uac-compact-value">{stats['uac']['accountLocked']}</span>
                                <span class="uac-compact-label">🔐 Account Locked Out</span>
                            </div>
                            <div class="uac-compact-item critical">
                                <span class="uac-compact-value">{stats['uac']['reversibleEncryption']}</span>
                                <span class="uac-compact-label">🔐 Reversible Encryption</span>
                            </div>
                            <div class="uac-compact-item warning">
                                <span class="uac-compact-value">{stats['uac']['useDESKey']}</span>
                                <span class="uac-compact-label">🔓 Use DES Key Only</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- LDAP Statistics -->
                <div class="stats-section">
                    <h3>🔍 LDAP Statistics</h3>
                    
                    <!-- Security Critical Attributes Section -->
                    <h4>🚨 Security Critical Attributes</h4>
                    <div class="stats-cards">
                        <div class="stat-card critical">
                            <div class="stat-value">{stats['ldap']['spnUsers']}</div>
                            <div class="stat-label">🎯 Has SPN (Kerberoastable)</div>
                        </div>
                        <div class="stat-card warning">
                            <div class="stat-value">{stats['ldap']['adminCountUsers']}</div>
                            <div class="stat-label">👑 AdminCount = 1</div>
                        </div>
                        <div class="stat-card warning">
                            <div class="stat-value">{stats['ldap']['constrainedDelegationTarget']}</div>
                            <div class="stat-label">🎭📌 Constrained Delegation (KCD w/o Protocol Transition)</div>
                        </div>
                        <div class="stat-card warning">
                            <div class="stat-value">{stats['ldap']['resourceBasedConstrainedDelegation']}</div>
                            <div class="stat-label">🎭🧩 RBCD Delegation </div>
                        </div>
                        {'<div class="stat-card critical"><div class="stat-value">' + str(stats['ldap']['unsupportedOS']) + '</div><div class="stat-label">🖥️ Unsupported OS</div></div>' if is_computers_file else ''}
                    </div>
                    
                    <!-- Information Disclosure Section -->
                    <h4>📝 Information Disclosure</h4>
                    <div class="stats-cards">
                        <div class="stat-card info">
                            <div class="stat-value">{stats['ldap']['hasDescription']}</div>
                            <div class="stat-label">📄 Has Description</div>
                        </div>
                    </div>
                </div>
                
                <!-- Object Types Distribution -->
                <div class="stats-section groups-section">
                    <h3>🏗️ Object Types Distribution</h3>
                    <div class="groups-list">
                        {object_types_html}
                    </div>
                </div>
                
                <!-- Groups Statistics -->
                <div class="stats-section groups-section">
                    <h3>👥 Groups Distribution ({len(sorted_groups)})</h3>
                    <div class="groups-list">
                        {groups_html}
                    </div>
                </div>
                
                <!-- UAC Flags Distribution -->
                <div class="stats-section uac-section">
                    <h3>🛡️ UAC Flags Distribution ({len(sorted_uac_stats)})</h3>
                    <div class="uac-stats-list">
                        {uac_html}
                    </div>
                </div>

                <!-- OS Distribution -->
                {os_html}
                
            </div>
        </div>
    '''
    
    return html

# ============================================================================
# HTML RENDERING FUNCTIONS
# ============================================================================
# Functions to convert LDAP data into HTML format for web display

def format_groups_chips_html(group_names):
    """
    Format group names as HTML chips
    
    Args:
        group_names (list): List of group names
        
    Returns:
        str: HTML string with group chips
    """
    if not group_names:
        return ""
    
    privileged_groups = {
        "Account Operators", "Administrators", "Backup Operators", "Server Operators",
        "DnsAdmins", "Domain Admins", "Enterprise Admins", "Schema Admins",
        "Group Policy Creator Owners", "Cert Publishers"
    }
    
    chips_html = '<div class="groups-chips">'
    for group_name in group_names:
        # Determine chip class based on group type
        chip_class = "group-chip"
        fire_icon_html = ""
        if group_name in privileged_groups or "admin" in group_name.lower() or "domain controllers" in group_name.lower():
            chip_class += " privileged-group"
        elif group_name == "Users" or group_name == "Domain Users":
            chip_class += " user-group"
        elif group_name == "Remote Management Users" or group_name == "Remote Desktop Users":
            chip_class += " remote-group"
        else:
            chip_class += " other-group"
            
        chips_html += f'<span class="{chip_class}" title="{group_name}">{group_name} {fire_icon_html}</span>'
    
    chips_html += '</div>'
    return chips_html
   
def render_entry(entry: dict, index: int) -> str:
    """
    Renders a single LDAP entry as HTML for the detail view
    
    Args:
        entry (dict): LDAP entry containing 'dn' and 'attributes' keys
        index (int): Unique index for generating HTML element IDs
        
    Returns:
        str: HTML string representing the entry with collapsible attributes
    """
    attributes = entry.get("attributes", {})
    dn = entry.get("dn", "")

    display_name = extract_display_name(attributes, dn)
    
    # Check if user is kerberoastable (has servicePrincipalName)
    kerberoastable = is_kerberoastable(attributes)

    # SPN icon HTML (can be styled via CSS)
    spn_chip_html = ''
    if kerberoastable:
        spn_chip_html = '<span class="spn-chip" title="Kerberoastable: Has SPN">🎯</span>'

    # Extract and format groups
    memberof_values = attributes.get("memberOf", [])
    group_names = extract_group_names(memberof_values, attributes)
    groups_chips_html = format_groups_chips_html(group_names)

    # Create collapsible entry header with toggle functionality
    html = f'''<div class="entry">
<div class="entry-header" onclick="toggle('attr{index}')">
    <h2>{display_name} {spn_chip_html}</h2>
    {groups_chips_html}
</div>
<div class="attributes" id="attr{index}">'''

    # Define minimal columns (same as ldapdomaindump)
    minimal_columns = {
        'cn', 'sAMAccountName', 'whenCreated', 'whenChanged', 'lastLogon', 
        'userAccountControl', 'pwdLastSet', 'objectSid', 'memberOf','description', 'servicePrincipalName',
        'dNSHostName', 'operatingSystem', 'operatingSystemVersion', 'operatingSystemServicePack',
        'securityIdentifier', 'trustAttributes', 'trustDirection', 'trustType'
    }

    # Build attributes table
    html += '<table class="attr-table">'
    for key, values in attributes.items():
        # Add data attribute to identify minimal columns
        row_class = 'minimal-column' if key in minimal_columns else 'extended-column'
        
        val = ', '.join(map(str, values))

        # Special handling for userAccountControl
        if key == "userAccountControl" and values:
            try:
                uac_value = int(values[0])
                uac_flags = decode_uac_flags(uac_value)
                val = format_uac_display_html(uac_value, uac_flags)
            except (ValueError, TypeError):
                pass

        html += f'<tr class="{row_class}"><td class="key">{key}</td><td class="value">{val}</td></tr>\n'
    html += "</table>\n</div>\n</div>\n"
    return html

def render_table(data: list, keys: list) -> str:
    """
    Renders all LDAP entries as an HTML table for the table view
    
    Args:
        data (list): List of LDAP entry dictionaries
        keys (list): List of all attribute names to include as columns
        
    Returns:
        str: HTML string representing a complete table with headers and data
    """
    # Define minimal columns (same as ldapdomaindump)
    minimal_columns = {
        'cn', 'sAMAccountName', 'whenCreated', 'whenChanged', 'lastLogon', 
        'userAccountControl', 'pwdLastSet', 'objectSid', 'memberOf','description', 'servicePrincipalName',
        'dNSHostName', 'operatingSystem', 'operatingSystemVersion', 'operatingSystemServicePack',
        'securityIdentifier', 'trustAttributes', 'trustDirection', 'trustType'
    }

    # Build table header with DN column first, then all attribute columns
    html = "<table>\n<thead><tr><th>DN</th>"
    for k in keys:
        # Add data attribute to identify minimal columns
        col_class = 'minimal-column' if k in minimal_columns else 'extended-column'
        html += f"<th class='{col_class}'>{k}</th>"
    html += "</tr></thead>\n<tbody>\n"

    # Process each LDAP entry as a table row
    for entry in data:
        attributes = entry.get("attributes", {})
        dn = entry.get("dn", "")
        display_name = extract_display_name(attributes, dn)
        
        html += f"<tr><td>{display_name}</td>"

        # Add cell for each attribute column
        for k in keys:
            # Add data attribute to identify minimal columns
            col_class = 'minimal-column' if k in minimal_columns else 'extended-column'
            
            values = attributes.get(k, [])
            val = ', '.join(map(str, values))

            # Special handling for userAccountControl
            if k == "userAccountControl" and values:
                try:
                    uac_value = int(values[0])
                    uac_flags = decode_uac_flags(uac_value)
                    val = format_uac_display_html(uac_value, uac_flags)
                except (ValueError, TypeError):
                    pass

            html += f"<td class='{col_class}'>{val}</td>"
        html += "</tr>\n"
    html += "</tbody>\n</table>\n"
    return html

# ============================================================================
# MAIN PROCESSING FUNCTION
# ============================================================================
# Core function that orchestrates the HTML generation process

def is_users_file(input_file) -> bool:
    """
    Determine if the file contains user objects
    
    Args:
        input_file (str): Path to the input file
        data (list): LDAP data entries
        
    Returns:
        bool: True if file contains users, False otherwise
    """
    # Check filename first
    filename = os.path.basename(input_file).lower()
    if 'users' in filename:
        return True
    else:
        return False
    
def is_computers_file(input_file) -> bool:
    """
    Determine if the file contains computer objects

    Args:
        input_file (str): Path to the input file
        data (list): LDAP data entries
        
    Returns:
        bool: True if file contains users, False otherwise
    """
    # Check filename first
    filename = os.path.basename(input_file).lower()
    if 'computer' in filename:
        return True
    else:
        return False

def is_policy_file(input_file) -> bool:
    """
    Determine if the file contains domain policy objects
    
    Args:
        input_file (str): Path to the input file
        
    Returns:
        bool: True if file contains policy, False otherwise
    """
    filename = os.path.basename(input_file).lower()
    if 'policy' in filename:
        return True
    return False

def render_policy_report(data, input_file):
    """
    Render a specific report for domain policy
    """
    output_file = "ldapviewer_" + os.path.splitext(os.path.basename(input_file))[0] + ".html"
    filename = os.path.basename(input_file)
    
    # Helper for duration formatting
    def format_duration(duration_str):
        if not duration_str or duration_str == "-":
            return duration_str
        
        # Handle "days" format (e.g. "42 days, 0:00:00")
        if "day" in duration_str:
            parts = duration_str.split(',')
            days_part = parts[0].strip()
            time_part = parts[1].strip() if len(parts) > 1 else "0:00:00"
        else:
            days_part = ""
            time_part = duration_str.strip()
            
        try:
            # Parse time part HH:MM:SS
            if ':' in time_part:
                time_part = time_part.split('.')[0] # Remove microseconds if present
                h, m, s = map(int, time_part.split(':'))
            else:
                h, m, s = 0, 0, 0
                
            result = []
            if days_part:
                result.append(days_part)
                
            if h > 0:
                result.append(f"{h} hour{'s' if h != 1 else ''}")
            if m > 0:
                result.append(f"{m} minute{'s' if m != 1 else ''}")
            if s > 0:
                result.append(f"{s} second{'s' if s != 1 else ''}")
                
            if not result:
                return "0 seconds"
                
            return ", ".join(result)
        except:
            return duration_str

    # Helper for pwdProperties decoding
    def decode_pwd_properties(val_list):
        if not val_list:
            return "-"
        try:
            val = int(val_list[0])
        except:
            return str(val_list[0])
            
        flags = []
        if val & 1: flags.append("DOMAIN_PASSWORD_COMPLEX")
        if val & 2: flags.append("DOMAIN_PASSWORD_NO_ANON_CHANGE")
        if val & 4: flags.append("DOMAIN_PASSWORD_NO_CLEAR_CHANGE")
        if val & 8: flags.append("DOMAIN_LOCKOUT_ADMINS")
        if val & 16: flags.append("DOMAIN_PASSWORD_STORE_CLEARTEXT")
        if val & 32: flags.append("DOMAIN_REFUSE_PASSWORD_CHANGE")
        
        if not flags:
            return str(val)
            
        return "<br>".join(flags)

    # Load styles from frontend/style.css
    base_dir = os.path.dirname(os.path.realpath(__file__))
    style_file = os.path.join(base_dir, "frontend", "style.css")
    try:
        with open(style_file, "r", encoding="utf-8") as f:
            style_content = f.read()
    except:
        style_content = ""
    
    content_html = ""
    
    # Define fields and their formatters
    policy_fields = [
        ("Distinguished Name", "distinguishedName", None),
        ("Lockout Observation Window", "lockOutObservationWindow", format_duration),
        ("Lockout Duration", "lockoutDuration", format_duration),
        ("Lockout Threshold", "lockoutThreshold", None),
        ("Max Password Age", "maxPwdAge", format_duration),
        ("Min Password Age", "minPwdAge", format_duration),
        ("Min Password Length", "minPwdLength", None),
        ("Password History Length", "pwdHistoryLength", None),
        ("Password Properties", "pwdProperties", decode_pwd_properties),
        ("Machine Account Quota", "ms-DS-MachineAccountQuota", None)
    ]

    for entry in data:
        attributes = entry.get("attributes", {})
        dn = entry.get("dn", "")
        display_name = extract_display_name(attributes, dn)
        
        entry_html = f'''
        <div class="policy-card">
            <div class="policy-header">
                <h2>🛡️ Domain Policy: {display_name}</h2>
            </div>
            <table class="policy-table">
        '''
        
        for label, key, formatter in policy_fields:
            values = attributes.get(key, [])
            
            if key == "pwdProperties":
                # Special handling for pwdProperties which needs the list/int
                val_str = formatter(values)
            else:
                if values:
                    raw_val = str(values[0])
                    if formatter:
                        val_str = formatter(raw_val)
                    else:
                        val_str = ', '.join(map(str, values))
                else:
                    val_str = "-"
            
            entry_html += f"<tr><td class='policy-key'>{label}</td><td class='policy-value'>{val_str}</td></tr>\n"
            
        entry_html += "</table>\n</div>\n"
        content_html += entry_html

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>LDAP Viewer - {filename}</title>
    <style>
        {style_content}
        
        /* Overrides for Policy Report */
        body {{
            padding: 40px;
            max-width: 1000px;
            margin: 0 auto;
        }}
        
        .header-container {{
            margin-bottom: 30px;
            border-bottom: 2px solid var(--border-light);
            padding-bottom: 20px;
        }}
        
        .policy-card {{
            background: var(--bg-secondary);
            border-radius: 12px;
            box-shadow: var(--shadow-medium);
            border: 1px solid var(--border-light);
            overflow: hidden;
            margin-bottom: 30px;
        }}
        
        .policy-header {{
            background: var(--accent-secondary);
            padding: 15px 25px;
            color: white;
        }}
        
        .policy-header h2 {{
            margin: 0;
            font-size: 18px;
            color: white;
        }}
        
        .policy-table {{
            width: 100%;
            border-collapse: collapse;
        }}
        
        .policy-table td {{
            padding: 12px 25px;
            border-bottom: 1px solid var(--border-light);
            color: var(--text-primary);
        }}
        
        .policy-table tr:last-child td {{
            border-bottom: none;
        }}
        
        .policy-key {{
            font-weight: 600;
            color: var(--text-secondary);
            width: 35%;
            background-color: var(--bg-tertiary);
        }}
        
        .policy-value {{
            font-family: 'Consolas', monospace;
        }}
        
        .footer {{
            text-align: center;
            margin-top: 50px;
            color: var(--text-muted);
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <div class="header-container">
        <h1>LDAP Viewer <span style="font-size: 0.6em; opacity: 0.7; font-weight: normal;">- {filename}</span></h1>
    </div>

    {content_html}
</body>
</html>'''

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"[+] Interactive HTML interface generated: {output_file}")

def main(input_file):
    """
    Main function that processes a JSON LDAP dump and generates an HTML viewer
    
    Args:
        input_file (str): Path to the input JSON file containing LDAP data
    """
    # Generate output filename based on input filename
    output_file = "ldapviewer_" + os.path.splitext(os.path.basename(input_file))[0] + ".html"

    # Determine paths to frontend resources (CSS, JS, HTML template)
    base_dir = os.path.dirname(os.path.realpath(__file__))
    frontend_dir = os.path.join(base_dir, "frontend")
    template_file = os.path.join(frontend_dir, "template.html")
    style_file = os.path.join(frontend_dir, "style.css")
    script_file = os.path.join(frontend_dir, "script.js")
    
    # Load and parse the LDAP JSON data
    try:
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"[!] Error: Invalid JSON in file '{input_file}': {e}")
        return
    except Exception as e:
        print(f"[!] Error reading file '{input_file}': {e}")
        return

    print(f"Processing {len(data)} entries from '{input_file}'")
    
    # Check if this is a policy file
    if is_policy_file(input_file):
        render_policy_report(data, input_file)
        return

    # Check if this is a users file
    is_users = is_users_file(input_file)

    # Generate HTML content for detail view
    detail_html = ""
    for idx, entry in enumerate(data):
        detail_html += render_entry(entry, idx)
    
    # Generate HTML content for table view
    keys = gather_all_keys(data)
    table_html = render_table(data, keys)
    
    # Calculate statistics and generate stats HTML
    stats = calculate_ldap_statistics(data)
    stats_html = render_statistics_html(stats, is_computers_file=is_computers_file(input_file))

    # Load frontend template and assets
    with open(template_file, "r", encoding="utf-8") as f:
        template = f.read()
    with open(style_file, "r", encoding="utf-8") as f:
        style_content = f.read()
    with open(script_file, "r", encoding="utf-8") as f:
        script_content = f.read()

    # Conditionally show/hide the group by button based on file type
    if not is_users:
        # Hide the group by button for non-user files
        style_content += "\n#groupByBtn { display: none !important; }"

    # Combine template with generated content and inline assets
    full_html = template.format(
        detail_content=detail_html,
        table_content=table_html,
        stats_content=stats_html,
        filename=os.path.basename(input_file),
        style_content=style_content,
        script_content=script_content
    )

    # Write the complete HTML file
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(full_html)

    print(f"[+] Interactive HTML interface generated: {output_file}")


logo_ascii = r"""
    __    __          _    ___                       
   / /___/ /___ _____| |  / (_)__ _      _____  _____
  / / __  / __ `/ __ \ | / / / _ \ | /| / / _ \/ ___/
 / / /_/ / /_/ / /_/ / |/ / /  __/ |/ |/ /  __/ /    
/_/\__,_/\__,_/ .___/|___/_/\___/|__/|__/\___/_/     
             /_/                                     
"""

if __name__ == "__main__":
    print(logo_ascii)
    print("LDAPViewer v3.0 - by NathanielSlw\n")
    
    parser = argparse.ArgumentParser(
        description='Generates an interactive HTML interface to explore ldapdomaindump JSON files.',
        epilog='Examples:\n  python ldapviewer.py domain_users.json\n  python ldapviewer.py domain_users.json domain_computers.json\n  python ldapviewer.py *.json',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser._positionals.title = 'arguments'
    parser.add_argument('json_files', nargs='+', help='One or more ldapdomaindump JSON files (domain_users.json, domain_computers.json, etc.)')

    args = parser.parse_args()
    input_files = args.json_files
    
    # Validate input files
    for input_file in input_files:
        if not os.path.isfile(input_file):
            print(f"[!] Error: Input file '{input_file}' not found.")
            sys.exit(1)
        if not input_file.lower().endswith('.json'):
            print(f"[!] Error: Input file '{input_file}' must have a .json extension.")
            sys.exit(1)

    # Process each file
    for input_file in input_files:
        main(input_file)