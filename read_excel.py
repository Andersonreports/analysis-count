import pandas as pd
import json

file_path = "Monthly analysed sample count -2022-2026.xlsx"

try:
    xl = pd.ExcelFile(file_path)
    data = {}
    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name)
        # Convert dataframe to a list of dicts or just a summary
        data[sheet_name] = df.to_dict(orient='records')
    
    print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error: {e}")
