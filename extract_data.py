import pandas as pd
import json
import os

file_path = "Monthly analysed sample count -2022-2026.xlsx"

def clean_value(val):
    if pd.isna(val):
        return None
    return val

try:
    xl = pd.ExcelFile(file_path)
    data = {}
    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name)
        records = df.to_dict(orient='records')
        # Deep clean records to remove NaN
        clean_records = []
        for rec in records:
            clean_rec = {str(k): (None if pd.isna(v) else v) for k, v in rec.items()}
            clean_records.append(clean_rec)
        data[sheet_name] = clean_records
    
    with open('data.json', 'w') as f:
        json.dump(data, f, indent=2)
    print("Data extracted to data.json")
except Exception as e:
    print(f"Error: {e}")
