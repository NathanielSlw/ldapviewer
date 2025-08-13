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
        if uac_value & flag_value:
            active_flags.append(flag_info)
    
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

# ============================================================================
# LDAP DATA PROCESSING UTILITIES
# ============================================================================
# Helper functions to extract and process LDAP entry data

def extract_display_name(attributes, dn):
    """
    Extract display name from LDAP entry attributes or DN
    
    Args:
        attributes (dict): LDAP entry attributes
        dn (str): Distinguished Name
        
    Returns:
        str: Display name (CN value or extracted from DN)
    """
    # Extract CN from attributes, fallback to DN if CN doesn't exist
    cn_values = attributes.get("cn", [])
    if cn_values:
        return cn_values[0]  # Take the first CN value
    else:  
        if dn and dn.upper().startswith('CN='):
            return dn.split(',')[0][3:]  # Remove "CN=" prefix
        else:
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
    
    chips_html = '<div class="groups-chips">'
    for group_name in group_names:
        # Determine chip class based on group type
        chip_class = "group-chip"
        if "admin" in group_name.lower() or "domain controllers" in group_name.lower():
            chip_class += " admin-group"
        elif group_name == "Users" or group_name == "Domain Users":
            chip_class += " user-group"
        elif group_name == "Remote Management Users" or group_name == "Remote Desktop Users":
            chip_class += " remote-group"
        else:
            chip_class += " other-group"
            
        chips_html += f'<span class="{chip_class}" title="{group_name}">{group_name}</span>'
    
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
    
    # Extract and format groups
    memberof_values = attributes.get("memberOf", [])
    group_names = extract_group_names(memberof_values, attributes)
    groups_chips_html = format_groups_chips_html(group_names)

    # Create collapsible entry header with toggle functionality
    html = f'''<div class="entry">
<div class="entry-header" onclick="toggle('attr{index}')">
    <h2>{display_name}</h2>
    {groups_chips_html}
</div>
<div class="attributes" id="attr{index}">'''


    # Build attributes table
    html += '<table class="attr-table">'
    for key, values in attributes.items():
        val = ', '.join(map(str, values))

        # Special handling for userAccountControl
        if key == "userAccountControl" and values:
            try:
                uac_value = int(values[0])
                uac_flags = decode_uac_flags(uac_value)
                val = format_uac_display_html(uac_value, uac_flags)
            except (ValueError, TypeError):
                pass

        html += f'<tr><td class="key">{key}</td><td class="value">{val}</td></tr>\n'
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
    # Build table header with DN column first, then all attribute columns
    html = "<table>\n<thead><tr><th>DN</th>"
    for k in keys:
        html += f"<th>{k}</th>"
    html += "</tr></thead>\n<tbody>\n"

    # Process each LDAP entry as a table row
    for entry in data:
        attributes = entry.get("attributes", {})
        dn = entry.get("dn", "")
        display_name = extract_display_name(attributes, dn)
        
        html += f"<tr><td>{display_name}</td>"

        # Add cell for each attribute column
        for k in keys:
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

            html += f"<td>{val}</td>"
        html += "</tr>\n"
    html += "</tbody>\n</table>\n"
    return html

# ============================================================================
# MAIN PROCESSING FUNCTION
# ============================================================================
# Core function that orchestrates the HTML generation process

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
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Generate HTML content for detail view
    detail_html = ""
    for idx, entry in enumerate(data):
        detail_html += render_entry(entry, idx)
    
    # Generate HTML content for table view
    keys = gather_all_keys(data)
    table_html = render_table(data, keys)

    # Load frontend template and assets
    with open(template_file, "r", encoding="utf-8") as f:
        template = f.read()
    with open(style_file, "r", encoding="utf-8") as f:
        style_content = f.read()
    with open(script_file, "r", encoding="utf-8") as f:
        script_content = f.read()

    # Combine template with generated content and inline assets
    full_html = template.format(
        detail_content=detail_html,
        table_content=table_html,
        filename=os.path.basename(input_file),
        style_content=style_content,
        script_content=script_content
    )

    # # Write the complete HTML file
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
    print("LDAPViewer v2.5 - by NathanielSlw\n")
    
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