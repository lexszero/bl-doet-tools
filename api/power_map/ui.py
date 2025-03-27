from typing import Iterable
import functools
import logging

from nicegui import ui
import folium
import folium.plugins

from power_grid.data_bl24 import PowerGrid_BL24
from power_grid.power_area import PowerArea
from power_grid.style import *

log = logging.getLogger('ui')

TABLE_AREAS_COLUMNS = [
        {'name': 'name', 'label': 'Area name', 'field': 'name', 'required': True},
        {'name': 'total_power_kw', 'label': 'P, kW', ':field': 'row => Math.round(row.total_power/1000)', 'sortable': True},
        {'name': 'total_power_kw_div3', 'label': 'P/3, kW', ':field': 'row => Math.round(row.total_power/1000/3)', 'sortable': True},
        {'name': 'total_power_kw_div6', 'label': 'P/6, kW', ':field': 'row => Math.round(row.total_power/1000/6)', 'sortable': True},
        {'name': 'num_consumers', 'label': '# camps', 'field': 'num_consumers' ,'sortable': True},
        {'name': 'population', 'label': 'Population', 'field': 'population', 'sortable': True},
        {'name': 'power_per_person', 'label': 'W/person', ':field': 'row => Math.round(row.total_power/row.population)', 'sortable': True},
        {'name': 'area_per_person', 'label': 'm²/person', ':field': 'row => Math.round(row.area/row.population)', 'sortable': True}
        ]

def build_table_areas(areas: Iterable[PowerArea]):
    table = ui.table(
            columns=TABLE_AREAS_COLUMNS,
            row_key='name',
            rows=[area.table_row() for area in areas],
            column_defaults={
                'headerClasses': 'text-primary'
                }).classes('dense w-full')
    table.add_slot('header', r'''
        <q-tr :props="props">
            <q-th auto-width />
            <q-th v-for="col in props.cols" :key="col.name" :props="props">
                {{ col.label }}
            </q-th>
        </q-tr>
''')
    table.add_slot('body', r'''
        <q-tr :props="props">
            <q-td auto-width>
                <q-btn size="sm" color="accent" round dense
                    @click="props.expand = !props.expand"
                    :icon="props.expand ? 'remove' : 'add'" />
            </q-td>
            <q-td v-for="col in props.cols" :key="col.name" :props="props">
                {{ col.value }}
            </q-td>
        </q-tr>
        <q-tr v-show="props.expand" :props="props">
            <q-td colspan="100%">
                <div class="text-left">{{ props.row.description }}</div>
            </q-td>
        </q-tr>
''')
    return table

def map_style_grid(feature):
    style = STYLE_GRID_ITEM_SIZE[PowerGridItemSize(feature['properties']['power_size'])]
    if feature['geometry']['type'] == 'Point':
        return {
                'color': style['color'],
                'radius': style['weight'],
                }
    elif feature['geometry']['type'] == 'LineString':
        return {
                'color': style['color'],
                'weight': style['weight'],
                }
    else:
        return {}

def map_style_consumers(color_function, feature):
    color = color_function(feature.properties)
    return {
            'weight': 1,
            'color': color,
            'opacity': 1.0,
            'fillOpacity': 0.3,
            }

def build_map_folium(data: PowerArea):
    m = folium.Map(location=[57.62377, 14.92715], tiles="Cartodb dark_matter", zoom_start=15)
    #layer_grid = folium.FeatureGroup(name='Power grid', control=True, overlay=True).add_to(m)
    layer_areas = folium.GeoJson(
            data.geojson_areas(),
            name='Power areas',
            style_function=lambda feature: {
                'weight': 1,
                'color': '#37872D',
                'opacity': 0.3,
                'fillOpacity': 0.15
                }
            ).add_to(m)
    layer_grid_coverage = folium.GeoJson(
            data.geojson_grid_coverage(),
            name='Grid coverage',
            style_function=lambda feature: {
                'weight': 1,
                'color': '#CCCCDC',
                'opacity': 0.3,
                'fillOpacity': 0.15
                }
            ).add_to(m)
    layer_grid = folium.GeoJson(
            data.geojson_grid(),
            name='Grid',
            marker=folium.Circle(radius=4, fill_color='orange', fill_opacity=1.0, weight=1),
            style_function=map_style_grid
            ).add_to(m)

    layer_consumers_power_need = folium.GeoJson(
            data.geojson_consumers(),
            name='Color by power need',
            style_function=functools.partial(map_style_consumers, color_consumer_power_need),
            popup=folium.GeoJsonPopup(['name', 'description', 'power_need'])
            ).add_to(m)
    layer_consumers_coverage = folium.GeoJson(
            data.geojson_consumers(),
            name='Color by coverage',
            show=False,
            style_function=functools.partial(map_style_consumers, color_consumer_grid_coverage),
            popup=folium.GeoJsonPopup(['name', 'description', 'power_need'])
            ).add_to(m)
    layer_consumers_off = folium.FeatureGroup(name='Off').add_to(m)

    #folium.FitOverlays().add_to(m)
    folium.plugins.GroupedLayerControl({
        'Consumers display': [
            layer_consumers_power_need,
            layer_consumers_coverage,
            layer_consumers_off
            ]},).add_to(m)

    #drawn_feature = folium.FeatureGroup(name='draw')
    #folium.plugins.Draw(feature_group=drawn_feature).add_to(m)

    #folium.plugins.GroupedLayerControl({
    #    'Grid': [
    #        layer_grid,
    #        layer_grid_coverage,
    #        ],
    #    'Map': [
    #        layer_areas
    #        ]
    #    }, exclusive_groups=False).add_to(m)

    folium.LayerControl().add_to(m)
    folium.plugins.MeasureControl().add_to(m)

    #m.get_root().render()
    #ui.add_head_html(m.get_root().header.render())
    #with ui.column():
    #    ui.html(m.get_root().html.render()).classes('w-1/2 h-screen')
    #ui.add_body_html('<script>function initMap() { '+m.get_root().script.render()+' }</script>')
    #ui.run_javascript('initMap();')
    m.get_root().width = f"100%"
    m.get_root().height = f"90%"
    ui.html(m.get_root()._repr_html_()).classes('w-1/2 h-screen')
    ui.add_css('''
    .foliumpopup {
        background-color: var(--q-dark-page);
        color: #fff;
    }
    ''')
    #with ui.card():
    #    m.get_root().width = f"{map_width}px"
    #    m.get_root().height = f"{map_height}px"
    #    iframe = m.get_root()._repr_html_()
    #    ui.html(iframe).classes("w-full h-full")

def build_map_leaflet(data):
    m = ui.leaflet(center=(57.62377, 14.92715), zoom=15).classes('w-1/2 h-screen')
    m.clear_layers()
    m.tile_layer(
            url_template='https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            options={
                'attribution': '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                'maxZoom': 20,
                })
    layer_areas = m.generic_layer(name='geoJSON', args=[data.geojson_areas(), {}])

    return m


def build_ui(data):

    dark = ui.dark_mode()
    dark.enable()
    with ui.row().classes('w-full'):
        #ui_map = build_map_folium(data)
        ui_map = build_map_leaflet(data)
        with ui.column():
            with ui.tabs().classes('w-full') as tabs:
                tab_areas = ui.tab('Areas')
            with ui.tab_panels(tabs, value=tab_areas).classes('w-full'):
                with ui.tab_panel(tab_areas).classes('w-full'):
                    build_table_areas(data.areas_recursive())
    #build_map(data)


def main():
    power_grid = PowerGrid_BL24()
    build_ui(power_grid.data)
    ui.run()

if __name__ in {'__main__', '__mp_main__'}:
    main()
