# `HardwareInfo.jsonl`

## UI / sample notes

One JSON object per line; discriminated by `"category"`. **Specified in docx; not present in `out.rep`.**

Example categories from the source doc:

```json
{"category":"Host Info","cpu_physical_count":2,"cpu_logical_count":46,"memory_total_size_MB":461897260,"disk_total_size_GB":2879978960}
{"category":"Device Info","npu_count":1,"chip_info":"Ascend 950PR_9599 V100","arch_info":"3510"}
{"category":"CPU Information","control_cpu_count":1,"ai_cpu_count":6,"ai_cpu_frequency_MHZ":1500}
{"category":"AI Core Information","ai_core_count":36,"ai_cube_count":36,"ai_vector_count":72,"ai_core_frequency_MHZ":[100,100]}
{"category":"Memory Information","hbm_total_MB":131072,"hbm_used_MB":5190.55,"hbm_frequency_MHZ":3200}
```

UI also shows host CPU model string (`Cpu Info`) that is **not** in these example lines — treat as an optional host field when available.

## Schema

§11.1.3.8.1. One JSON object per line, discriminated by `category`.

| `category` | Fields |
| --- | --- |
| `Host Info` | `cpu_physical_count`, `cpu_logical_count`, `memory_total_size_MB`, `disk_total_size_GB` |
| `Device Info` | `npu_count`, `chip_info`, `arch_info` |
| `CPU Information` | `control_cpu_count`, `ai_cpu_count`, `ai_cpu_frequency_MHZ` |
| `AI Core Information` | `ai_core_count`, `ai_cube_count`, `ai_vector_count`, `ai_core_frequency_MHZ` (array) |
| `Memory Information` | `hbm_total_MB`, `hbm_used_MB`, `hbm_frequency_MHZ` |
