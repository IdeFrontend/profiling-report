my 1st idea is the following: lets limit scale factor to scale where ULP will result to around 1 of device pixel
we can investigate this in real app usage and may be take it or (if not) use approach 2:
if ulp change is more than 1/4 device pixels, we will rebuild mesh for  visible events on eveny frame with native fp64 JS precision
preserving old full mesh, this will not eat much resources and time because on such huge scales a very low number of events is visible
also we can reuse meshed and cache it to avoid allocations on every flame and have limited number of mesh allocations during full app cycle

