# Schema and Prompt

## JSON Schema (Example)
```json
{
  "task": "asset_generation",
  "input": {
    "imageUrl": "https://...",
    "category": "desk_accessory",
    "styleTags": ["minimal", "oak", "warm"]
  },
  "output": {
    "assetName": "oak_monitor_stand",
    "description": "Minimal oak monitor stand with rounded corners",
    "tags": ["desk", "monitor", "wood"],
    "license": "CC0",
    "sourceAttribution": "user-upload",
    "estimatedDimensionsMeters": [0.56, 0.12, 0.21]
  }
}
```

## Prompt Template
```
You are a deskterior asset AI assistant.
Generate ONLY JSON for an asset-generation task.
Do not output floorplan/topology entities such as walls/openings.
Required:
- task = "asset_generation"
- output.assetName, output.tags, output.license
Optional:
- output.estimatedDimensionsMeters when confidence is sufficient.
If model generation fails, return:
{ "task": "asset_generation", "error": { "code": "...", "message": "..." } }
```
