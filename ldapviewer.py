#!/usr/bin/env python3

import json
import sys
import os
import argparse

# ============================================================================
# HTML RENDERING FUNCTIONS
# ============================================================================
# Functions to convert LDAP data into HTML format for web display

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

    # Create collapsible entry header with toggle functionality
    html = f'<div class="entry">\n<h2 onclick="toggle(\'attr{index}\')">{dn}</h2>\n<div class="attributes" id="attr{index}">'

    # Build attributes table
    html += '<table class="attr-table">'
    for key, values in attributes.items():
        val = ', '.join(map(str, values))
        html += f'<tr><td class="key">{key}</td><td class="value">{val}</td></tr>\n'
    html += "</table>\n</div>\n</div>\n"
    return html

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
        html += f"<tr><td>{dn}</td>"

        # Add cell for each attribute column
        for k in keys:
            values = attributes.get(k, [])
            val = ', '.join(map(str, values))
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
    print("LDAPViewer v2.3 - by NathanielSlw\n")
    
    parser = argparse.ArgumentParser(
        description='Generates an interactive HTML interface to explore ldapdomaindump JSON files.',
        epilog='Example: python ldapviewer.py domain_users.json\nOutput: Opens ldapviewer_domain_users.html in your browser',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser._positionals.title = 'arguments'
    parser.add_argument('json_file', help='ldapdomaindump JSON file (domain_users.json, domain_computers.json, etc.)')
    
    args = parser.parse_args()
    input_file = args.json_file
    
    # Validate input file
    if not os.path.isfile(input_file):
        print(f"[!] Error: Input file '{input_file}' not found.")
        sys.exit(1)
    if not input_file.lower().endswith('.json'):
        print(f"[!] Error: Input file must have a .json extension.")
        sys.exit(1)
        
    main(input_file)
