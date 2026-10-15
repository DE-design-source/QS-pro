-- Tách thông số RIÊNG từng ngành khỏi bảng products (141 cột) thành 4 bảng 1-1.
-- products giữ: định danh, thương mại, 5 trục biến thể, cột dùng từ 2 ngành trở lên, tài liệu, duyệt.
-- View product_catalog nối lại đủ 141 cột với tên như cũ; lớp server/supa.js đọc qua view và
-- tách cột theo bảng khi ghi. Dòng thông số chỉ tồn tại khi sản phẩm có ít nhất 1 giá trị ở bảng đó.

-- ===== product_lighting_specs (22 cột) =====
create table product_lighting_specs (
  product_id bigint not null,
  luminous_flux_lm numeric,
  tilt_angle_deg text,
  height_mm numeric,
  diameter_mm numeric,
  cutout_mm text,
  cri text,
  luminous_efficacy_lm_w numeric,
  ugr text,
  sdcm text,
  coi text,
  lifespan text,
  led_chip_type text,
  protection_class text,
  has_separate_driver boolean,
  driver_name text,
  driver_code text,
  driver_brand text,
  driver_mounting_position text,
  control_compatibility text,
  max_output_current_ma numeric,
  led_chip_name text,
  driver_price numeric,
  constraint pk_product_lighting_specs primary key (product_id),
  constraint fk_product_lighting_specs_product_id foreign key (product_id) references products (id) on delete cascade,
  constraint ck_product_lighting_specs_luminous_flux_lm CHECK ((luminous_flux_lm >= (0)::numeric)),
  constraint ck_product_lighting_specs_diameter_mm CHECK ((diameter_mm >= (0)::numeric)),
  constraint ck_product_lighting_specs_luminous_efficacy_lm_w CHECK ((luminous_efficacy_lm_w >= (0)::numeric)),
  constraint ck_product_lighting_specs_max_output_current_ma CHECK ((max_output_current_ma >= (0)::numeric)),
  constraint ck_product_lighting_specs_driver_price CHECK ((driver_price >= (0)::numeric))
);
comment on table product_lighting_specs is 'Lighting specifications of a product (1-1 with products; row exists only when at least one value is set).';
comment on column product_lighting_specs.luminous_flux_lm is 'Luminous flux in lumens';
comment on column product_lighting_specs.tilt_angle_deg is 'Tilt angle in degrees; free text';
comment on column product_lighting_specs.height_mm is 'Height in millimetres';
comment on column product_lighting_specs.diameter_mm is 'Diameter in millimetres';
comment on column product_lighting_specs.cutout_mm is 'Ceiling cut-out size in millimetres; free text';
comment on column product_lighting_specs.cri is 'Color rendering index; free text';
comment on column product_lighting_specs.luminous_efficacy_lm_w is 'Luminous efficacy in lm/W';
comment on column product_lighting_specs.ugr is 'Unified glare rating';
comment on column product_lighting_specs.sdcm is 'Color consistency (SDCM / MacAdam steps)';
comment on column product_lighting_specs.coi is 'COI lighting index as entered on the form';
comment on column product_lighting_specs.lifespan is 'Rated lifespan; free text';
comment on column product_lighting_specs.led_chip_type is 'LED chip package type (COB / SMD / module)';
comment on column product_lighting_specs.protection_class is 'Electrical protection class (Class I/II/III)';
comment on column product_lighting_specs.has_separate_driver is 'True when the luminaire uses a separately mounted driver';
comment on column product_lighting_specs.driver_name is 'Driver (power supply) name';
comment on column product_lighting_specs.driver_code is 'Driver model code';
comment on column product_lighting_specs.driver_brand is 'Driver manufacturer';
comment on column product_lighting_specs.driver_mounting_position is 'Where the driver is mounted';
comment on column product_lighting_specs.control_compatibility is 'Compatible control / dimming protocols';
comment on column product_lighting_specs.max_output_current_ma is 'Maximum driver output current in mA';
comment on column product_lighting_specs.led_chip_name is 'LED chip maker / model (Bridgelux, Cree, ...)';
comment on column product_lighting_specs.driver_price is 'Selling price of the driver (VND)';
insert into product_lighting_specs (product_id, luminous_flux_lm, tilt_angle_deg, height_mm, diameter_mm, cutout_mm, cri, luminous_efficacy_lm_w, ugr, sdcm, coi, lifespan, led_chip_type, protection_class, has_separate_driver, driver_name, driver_code, driver_brand, driver_mounting_position, control_compatibility, max_output_current_ma, led_chip_name, driver_price)
  select id, luminous_flux_lm, tilt_angle_deg, height_mm, diameter_mm, cutout_mm, cri, luminous_efficacy_lm_w, ugr, sdcm, coi, lifespan, led_chip_type, protection_class, has_separate_driver, driver_name, driver_code, driver_brand, driver_mounting_position, control_compatibility, max_output_current_ma, led_chip_name, driver_price from products
  where luminous_flux_lm is not null or tilt_angle_deg is not null or height_mm is not null or diameter_mm is not null or cutout_mm is not null or cri is not null or luminous_efficacy_lm_w is not null or ugr is not null or sdcm is not null or coi is not null or lifespan is not null or led_chip_type is not null or protection_class is not null or has_separate_driver is not null or driver_name is not null or driver_code is not null or driver_brand is not null or driver_mounting_position is not null or control_compatibility is not null or max_output_current_ma is not null or led_chip_name is not null or driver_price is not null;

-- ===== product_sanitary_specs (21 cột) =====
create table product_sanitary_specs (
  product_id bigint not null,
  flush_system text,
  flush_volume text,
  design text,
  rough_in_distance text,
  water_pressure text,
  lid_type text,
  faucet_type text,
  shower_type text,
  control_type text,
  massage_function text,
  bowl_count text,
  flow_rate text,
  valve_cartridge text,
  shower_head_size text,
  spray_modes text,
  faucet_hole_count text,
  overflow_hole text,
  capacity text,
  power_supply text,
  compatible_toilet text,
  thickness text,
  constraint pk_product_sanitary_specs primary key (product_id),
  constraint fk_product_sanitary_specs_product_id foreign key (product_id) references products (id) on delete cascade
);
comment on table product_sanitary_specs is 'Sanitary ware specifications of a product (1-1 with products; row exists only when at least one value is set).';
comment on column product_sanitary_specs.flush_system is 'Sanitary: flush system (e.g. Tornado)';
comment on column product_sanitary_specs.flush_volume is 'Sanitary: flush water volume (e.g. 4.5/3L)';
comment on column product_sanitary_specs.design is 'Sanitary: design description';
comment on column product_sanitary_specs.rough_in_distance is 'Sanitary: drain rough-in distance (e.g. 305 mm)';
comment on column product_sanitary_specs.water_pressure is 'Sanitary: working water pressure range';
comment on column product_sanitary_specs.lid_type is 'Sanitary: toilet lid / seat type';
comment on column product_sanitary_specs.faucet_type is 'Sanitary: faucet type';
comment on column product_sanitary_specs.shower_type is 'Sanitary: shower type';
comment on column product_sanitary_specs.control_type is 'Sanitary: control type (e.g. remote, side panel)';
comment on column product_sanitary_specs.massage_function is 'Sanitary: massage function (yes/no text)';
comment on column product_sanitary_specs.bowl_count is 'Sanitary: number of sink bowls (text option)';
comment on column product_sanitary_specs.flow_rate is 'Sanitary: water flow rate (e.g. 6 L/min)';
comment on column product_sanitary_specs.valve_cartridge is 'Sanitary: valve cartridge';
comment on column product_sanitary_specs.shower_head_size is 'Sanitary: shower head size';
comment on column product_sanitary_specs.spray_modes is 'Sanitary: spray modes';
comment on column product_sanitary_specs.faucet_hole_count is 'Sanitary: number of faucet holes (text option)';
comment on column product_sanitary_specs.overflow_hole is 'Sanitary: overflow hole (yes/no text)';
comment on column product_sanitary_specs.capacity is 'Sanitary: capacity (e.g. 220 L)';
comment on column product_sanitary_specs.power_supply is 'Sanitary: electrical supply (e.g. 220V/50Hz)';
comment on column product_sanitary_specs.compatible_toilet is 'Sanitary: toilets the electronic seat fits';
comment on column product_sanitary_specs.thickness is 'Material thickness (e.g. 1.2 mm)';
insert into product_sanitary_specs (product_id, flush_system, flush_volume, design, rough_in_distance, water_pressure, lid_type, faucet_type, shower_type, control_type, massage_function, bowl_count, flow_rate, valve_cartridge, shower_head_size, spray_modes, faucet_hole_count, overflow_hole, capacity, power_supply, compatible_toilet, thickness)
  select id, flush_system, flush_volume, design, rough_in_distance, water_pressure, lid_type, faucet_type, shower_type, control_type, massage_function, bowl_count, flow_rate, valve_cartridge, shower_head_size, spray_modes, faucet_hole_count, overflow_hole, capacity, power_supply, compatible_toilet, thickness from products
  where flush_system is not null or flush_volume is not null or design is not null or rough_in_distance is not null or water_pressure is not null or lid_type is not null or faucet_type is not null or shower_type is not null or control_type is not null or massage_function is not null or bowl_count is not null or flow_rate is not null or valve_cartridge is not null or shower_head_size is not null or spray_modes is not null or faucet_hole_count is not null or overflow_hole is not null or capacity is not null or power_supply is not null or compatible_toilet is not null or thickness is not null;

-- ===== product_paint_specs (18 cột) =====
create table product_paint_specs (
  product_id bigint not null,
  coverage text,
  drying_time text,
  coat_count text,
  physical_state text,
  odor text,
  odor_threshold text,
  ph_value text,
  melting_freezing_point text,
  boiling_point text,
  flash_point text,
  flammability text,
  explosive_limits text,
  vapor_pressure text,
  vapor_density text,
  water_solubility text,
  viscosity text,
  particle_characteristics text,
  relative_density text,
  constraint pk_product_paint_specs primary key (product_id),
  constraint fk_product_paint_specs_product_id foreign key (product_id) references products (id) on delete cascade
);
comment on table product_paint_specs is 'Paint specifications of a product (1-1 with products; row exists only when at least one value is set).';
comment on column product_paint_specs.coverage is 'Paint: coverage (e.g. 13 m2/litre/coat)';
comment on column product_paint_specs.drying_time is 'Paint: drying time';
comment on column product_paint_specs.coat_count is 'Paint: recommended number of coats (text option 1/2/3)';
comment on column product_paint_specs.physical_state is 'Paint SDS: physical state (liquid / powder / paste)';
comment on column product_paint_specs.odor is 'Paint SDS: odor';
comment on column product_paint_specs.odor_threshold is 'Paint SDS: odor threshold';
comment on column product_paint_specs.ph_value is 'Paint SDS: pH';
comment on column product_paint_specs.melting_freezing_point is 'Paint SDS: melting / freezing point';
comment on column product_paint_specs.boiling_point is 'Paint SDS: boiling point and range';
comment on column product_paint_specs.flash_point is 'Paint SDS: flash point';
comment on column product_paint_specs.flammability is 'Paint SDS: flammability';
comment on column product_paint_specs.explosive_limits is 'Paint SDS: lower and upper explosive limits';
comment on column product_paint_specs.vapor_pressure is 'Paint SDS: vapor pressure';
comment on column product_paint_specs.vapor_density is 'Paint SDS: relative vapor density';
comment on column product_paint_specs.water_solubility is 'Paint SDS: solubility in water';
comment on column product_paint_specs.viscosity is 'Paint SDS: viscosity (e.g. 2477 mm2/s)';
comment on column product_paint_specs.particle_characteristics is 'Paint SDS: particle characteristics';
comment on column product_paint_specs.relative_density is 'Paint SDS: relative density (distinct from vapor density)';
insert into product_paint_specs (product_id, coverage, drying_time, coat_count, physical_state, odor, odor_threshold, ph_value, melting_freezing_point, boiling_point, flash_point, flammability, explosive_limits, vapor_pressure, vapor_density, water_solubility, viscosity, particle_characteristics, relative_density)
  select id, coverage, drying_time, coat_count, physical_state, odor, odor_threshold, ph_value, melting_freezing_point, boiling_point, flash_point, flammability, explosive_limits, vapor_pressure, vapor_density, water_solubility, viscosity, particle_characteristics, relative_density from products
  where coverage is not null or drying_time is not null or coat_count is not null or physical_state is not null or odor is not null or odor_threshold is not null or ph_value is not null or melting_freezing_point is not null or boiling_point is not null or flash_point is not null or flammability is not null or explosive_limits is not null or vapor_pressure is not null or vapor_density is not null or water_solubility is not null or viscosity is not null or particle_characteristics is not null or relative_density is not null;

-- ===== product_switch_socket_specs (39 cột) =====
create table product_switch_socket_specs (
  product_id bigint not null,
  component_type text,
  socket_count text,
  plug_type text,
  gang_count text,
  circuit_type text,
  operation_type text,
  indicator_light text,
  safety_shutter text,
  pack_quantity text,
  rated_current_a text,
  rated_voltage_v text,
  max_power_w text,
  max_load_power_w text,
  min_load_power_w text,
  load_type text,
  operation_cycles text,
  frequency_hz text,
  contact_material text,
  flame_resistance text,
  standards text,
  certifications text,
  usb_a_port_count text,
  usb_c_port_count text,
  usb_charging_power_w text,
  usb_output text,
  signal_connector_type text,
  smart_integration text,
  connectivity_protocol text,
  compatible_ecosystem text,
  neutral_wire text,
  sensor_type text,
  smart_features text,
  module_count text,
  face_width_mm text,
  face_height_mm text,
  face_depth_mm text,
  mounting_box_type text,
  min_box_depth_mm text,
  max_wire_cross_section text,
  constraint pk_product_switch_socket_specs primary key (product_id),
  constraint fk_product_switch_socket_specs_product_id foreign key (product_id) references products (id) on delete cascade
);
comment on table product_switch_socket_specs is 'Switch / socket specifications of a product (1-1 with products; row exists only when at least one value is set).';
comment on column product_switch_socket_specs.component_type is 'Switch/socket spec (was: thanh_phan)';
comment on column product_switch_socket_specs.socket_count is 'Switch/socket spec (was: so_o_cam)';
comment on column product_switch_socket_specs.plug_type is 'Switch/socket spec (was: kieu_chau)';
comment on column product_switch_socket_specs.gang_count is 'Switch/socket spec (was: so_nut)';
comment on column product_switch_socket_specs.circuit_type is 'Switch/socket spec (was: kieu_mach)';
comment on column product_switch_socket_specs.operation_type is 'Switch/socket spec (was: kieu_thao_tac)';
comment on column product_switch_socket_specs.indicator_light is 'Switch/socket spec (was: den_bao)';
comment on column product_switch_socket_specs.safety_shutter is 'Switch/socket spec (was: man_che)';
comment on column product_switch_socket_specs.pack_quantity is 'Switch/socket spec (was: quy_cach)';
comment on column product_switch_socket_specs.rated_current_a is 'Switch/socket spec (was: dong_dm_a)';
comment on column product_switch_socket_specs.rated_voltage_v is 'Switch/socket spec (was: dien_ap_v)';
comment on column product_switch_socket_specs.max_power_w is 'Switch/socket spec (was: cong_suat_max_w)';
comment on column product_switch_socket_specs.max_load_power_w is 'Switch/socket spec (was: cong_suat_tai_max_w)';
comment on column product_switch_socket_specs.min_load_power_w is 'Switch/socket spec (was: cong_suat_tai_min_w)';
comment on column product_switch_socket_specs.load_type is 'Switch/socket spec (was: loai_tai)';
comment on column product_switch_socket_specs.operation_cycles is 'Switch/socket spec (was: tuoi_tho_lan)';
comment on column product_switch_socket_specs.frequency_hz is 'Switch/socket spec (was: tan_so_hz)';
comment on column product_switch_socket_specs.contact_material is 'Switch/socket spec (was: vat_lieu_tiep_diem)';
comment on column product_switch_socket_specs.flame_resistance is 'Switch/socket spec (was: chong_chay)';
comment on column product_switch_socket_specs.standards is 'Switch/socket spec (was: tieu_chuan)';
comment on column product_switch_socket_specs.certifications is 'Switch/socket spec (was: chung_nhan)';
comment on column product_switch_socket_specs.usb_a_port_count is 'Switch/socket spec (was: so_usb_a)';
comment on column product_switch_socket_specs.usb_c_port_count is 'Switch/socket spec (was: so_usb_c)';
comment on column product_switch_socket_specs.usb_charging_power_w is 'Switch/socket spec (was: cong_suat_sac_w)';
comment on column product_switch_socket_specs.usb_output is 'Switch/socket spec (was: usb_ra)';
comment on column product_switch_socket_specs.signal_connector_type is 'Switch/socket spec (was: loai_tin_hieu)';
comment on column product_switch_socket_specs.smart_integration is 'Switch/socket spec (was: thong_minh)';
comment on column product_switch_socket_specs.connectivity_protocol is 'Switch/socket spec (was: giao_thuc)';
comment on column product_switch_socket_specs.compatible_ecosystem is 'Switch/socket spec (was: he_sinh_thai)';
comment on column product_switch_socket_specs.neutral_wire is 'Switch/socket spec (was: day_trung_tinh)';
comment on column product_switch_socket_specs.sensor_type is 'Switch/socket spec (was: loai_cam_bien)';
comment on column product_switch_socket_specs.smart_features is 'Switch/socket spec (was: tinh_nang_tm)';
comment on column product_switch_socket_specs.module_count is 'Switch/socket spec (was: so_module)';
comment on column product_switch_socket_specs.face_width_mm is 'Switch/socket spec (was: rong_mm)';
comment on column product_switch_socket_specs.face_height_mm is 'Switch/socket spec (was: cao_mm)';
comment on column product_switch_socket_specs.face_depth_mm is 'Switch/socket spec (was: sau_mm)';
comment on column product_switch_socket_specs.mounting_box_type is 'Switch/socket spec (was: loai_de)';
comment on column product_switch_socket_specs.min_box_depth_mm is 'Switch/socket spec (was: sau_hop_am_mm)';
comment on column product_switch_socket_specs.max_wire_cross_section is 'Switch/socket spec (was: tiet_dien_day)';
insert into product_switch_socket_specs (product_id, component_type, socket_count, plug_type, gang_count, circuit_type, operation_type, indicator_light, safety_shutter, pack_quantity, rated_current_a, rated_voltage_v, max_power_w, max_load_power_w, min_load_power_w, load_type, operation_cycles, frequency_hz, contact_material, flame_resistance, standards, certifications, usb_a_port_count, usb_c_port_count, usb_charging_power_w, usb_output, signal_connector_type, smart_integration, connectivity_protocol, compatible_ecosystem, neutral_wire, sensor_type, smart_features, module_count, face_width_mm, face_height_mm, face_depth_mm, mounting_box_type, min_box_depth_mm, max_wire_cross_section)
  select id, component_type, socket_count, plug_type, gang_count, circuit_type, operation_type, indicator_light, safety_shutter, pack_quantity, rated_current_a, rated_voltage_v, max_power_w, max_load_power_w, min_load_power_w, load_type, operation_cycles, frequency_hz, contact_material, flame_resistance, standards, certifications, usb_a_port_count, usb_c_port_count, usb_charging_power_w, usb_output, signal_connector_type, smart_integration, connectivity_protocol, compatible_ecosystem, neutral_wire, sensor_type, smart_features, module_count, face_width_mm, face_height_mm, face_depth_mm, mounting_box_type, min_box_depth_mm, max_wire_cross_section from products
  where component_type is not null or socket_count is not null or plug_type is not null or gang_count is not null or circuit_type is not null or operation_type is not null or indicator_light is not null or safety_shutter is not null or pack_quantity is not null or rated_current_a is not null or rated_voltage_v is not null or max_power_w is not null or max_load_power_w is not null or min_load_power_w is not null or load_type is not null or operation_cycles is not null or frequency_hz is not null or contact_material is not null or flame_resistance is not null or standards is not null or certifications is not null or usb_a_port_count is not null or usb_c_port_count is not null or usb_charging_power_w is not null or usb_output is not null or signal_connector_type is not null or smart_integration is not null or connectivity_protocol is not null or compatible_ecosystem is not null or neutral_wire is not null or sensor_type is not null or smart_features is not null or module_count is not null or face_width_mm is not null or face_height_mm is not null or face_depth_mm is not null or mounting_box_type is not null or min_box_depth_mm is not null or max_wire_cross_section is not null;

-- ===== bỏ cột đã chuyển khỏi products =====
alter table products drop constraint ck_products_luminous_flux_lm;
alter table products drop constraint ck_products_diameter_mm;
alter table products drop constraint ck_products_luminous_efficacy_lm_w;
alter table products drop constraint ck_products_max_output_current_ma;
alter table products drop constraint ck_products_driver_price;
alter table products
  drop column luminous_flux_lm,
  drop column tilt_angle_deg,
  drop column height_mm,
  drop column diameter_mm,
  drop column cutout_mm,
  drop column cri,
  drop column luminous_efficacy_lm_w,
  drop column ugr,
  drop column sdcm,
  drop column coi,
  drop column lifespan,
  drop column led_chip_type,
  drop column protection_class,
  drop column has_separate_driver,
  drop column driver_name,
  drop column driver_code,
  drop column driver_brand,
  drop column driver_mounting_position,
  drop column control_compatibility,
  drop column max_output_current_ma,
  drop column led_chip_name,
  drop column driver_price,
  drop column flush_system,
  drop column flush_volume,
  drop column design,
  drop column rough_in_distance,
  drop column water_pressure,
  drop column lid_type,
  drop column faucet_type,
  drop column shower_type,
  drop column control_type,
  drop column massage_function,
  drop column bowl_count,
  drop column flow_rate,
  drop column valve_cartridge,
  drop column shower_head_size,
  drop column spray_modes,
  drop column faucet_hole_count,
  drop column overflow_hole,
  drop column capacity,
  drop column power_supply,
  drop column compatible_toilet,
  drop column thickness,
  drop column coverage,
  drop column drying_time,
  drop column coat_count,
  drop column physical_state,
  drop column odor,
  drop column odor_threshold,
  drop column ph_value,
  drop column melting_freezing_point,
  drop column boiling_point,
  drop column flash_point,
  drop column flammability,
  drop column explosive_limits,
  drop column vapor_pressure,
  drop column vapor_density,
  drop column water_solubility,
  drop column viscosity,
  drop column particle_characteristics,
  drop column relative_density,
  drop column component_type,
  drop column socket_count,
  drop column plug_type,
  drop column gang_count,
  drop column circuit_type,
  drop column operation_type,
  drop column indicator_light,
  drop column safety_shutter,
  drop column pack_quantity,
  drop column rated_current_a,
  drop column rated_voltage_v,
  drop column max_power_w,
  drop column max_load_power_w,
  drop column min_load_power_w,
  drop column load_type,
  drop column operation_cycles,
  drop column frequency_hz,
  drop column contact_material,
  drop column flame_resistance,
  drop column standards,
  drop column certifications,
  drop column usb_a_port_count,
  drop column usb_c_port_count,
  drop column usb_charging_power_w,
  drop column usb_output,
  drop column signal_connector_type,
  drop column smart_integration,
  drop column connectivity_protocol,
  drop column compatible_ecosystem,
  drop column neutral_wire,
  drop column sensor_type,
  drop column smart_features,
  drop column module_count,
  drop column face_width_mm,
  drop column face_height_mm,
  drop column face_depth_mm,
  drop column mounting_box_type,
  drop column min_box_depth_mm,
  drop column max_wire_cross_section;

-- ===== view đọc: đủ cột như bảng products trước khi tách =====
create view product_catalog as
select p.*,
  s0.luminous_flux_lm,
  s0.tilt_angle_deg,
  s0.height_mm,
  s0.diameter_mm,
  s0.cutout_mm,
  s0.cri,
  s0.luminous_efficacy_lm_w,
  s0.ugr,
  s0.sdcm,
  s0.coi,
  s0.lifespan,
  s0.led_chip_type,
  s0.protection_class,
  s0.has_separate_driver,
  s0.driver_name,
  s0.driver_code,
  s0.driver_brand,
  s0.driver_mounting_position,
  s0.control_compatibility,
  s0.max_output_current_ma,
  s0.led_chip_name,
  s0.driver_price,
  s1.flush_system,
  s1.flush_volume,
  s1.design,
  s1.rough_in_distance,
  s1.water_pressure,
  s1.lid_type,
  s1.faucet_type,
  s1.shower_type,
  s1.control_type,
  s1.massage_function,
  s1.bowl_count,
  s1.flow_rate,
  s1.valve_cartridge,
  s1.shower_head_size,
  s1.spray_modes,
  s1.faucet_hole_count,
  s1.overflow_hole,
  s1.capacity,
  s1.power_supply,
  s1.compatible_toilet,
  s1.thickness,
  s2.coverage,
  s2.drying_time,
  s2.coat_count,
  s2.physical_state,
  s2.odor,
  s2.odor_threshold,
  s2.ph_value,
  s2.melting_freezing_point,
  s2.boiling_point,
  s2.flash_point,
  s2.flammability,
  s2.explosive_limits,
  s2.vapor_pressure,
  s2.vapor_density,
  s2.water_solubility,
  s2.viscosity,
  s2.particle_characteristics,
  s2.relative_density,
  s3.component_type,
  s3.socket_count,
  s3.plug_type,
  s3.gang_count,
  s3.circuit_type,
  s3.operation_type,
  s3.indicator_light,
  s3.safety_shutter,
  s3.pack_quantity,
  s3.rated_current_a,
  s3.rated_voltage_v,
  s3.max_power_w,
  s3.max_load_power_w,
  s3.min_load_power_w,
  s3.load_type,
  s3.operation_cycles,
  s3.frequency_hz,
  s3.contact_material,
  s3.flame_resistance,
  s3.standards,
  s3.certifications,
  s3.usb_a_port_count,
  s3.usb_c_port_count,
  s3.usb_charging_power_w,
  s3.usb_output,
  s3.signal_connector_type,
  s3.smart_integration,
  s3.connectivity_protocol,
  s3.compatible_ecosystem,
  s3.neutral_wire,
  s3.sensor_type,
  s3.smart_features,
  s3.module_count,
  s3.face_width_mm,
  s3.face_height_mm,
  s3.face_depth_mm,
  s3.mounting_box_type,
  s3.min_box_depth_mm,
  s3.max_wire_cross_section
from products p
left join product_lighting_specs s0 on s0.product_id = p.id
left join product_sanitary_specs s1 on s1.product_id = p.id
left join product_paint_specs s2 on s2.product_id = p.id
left join product_switch_socket_specs s3 on s3.product_id = p.id;
comment on view product_catalog is 'products + the 4 per-sector spec tables, one row per product with every column. Read-only: writes go to the base tables (server/supa.js splits them). Recreate this view (drop + create) whenever a column is added to products or to any product_*_specs table.';
