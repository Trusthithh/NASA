import asyncio

from app.api.datasets import list_datasets


def test_dataset_metadata_lists_categorized_variables():
    datasets = asyncio.run(list_datasets())
    by_id = {dataset.id: dataset for dataset in datasets}

    assert set(by_id) == {
        "skin_temperature",
        "dew_point",
        "precipitation",
        "soil_moisture",
        "snow_fraction",
        "specific_humidity",
        "aerosol",
        "clear_sky_solar",
    }
    assert {dataset.category for dataset in datasets} == {
        "Temperature",
        "Water",
        "Atmosphere",
        "Energy",
    }
    assert by_id["aerosol"].start_year == 2001
    assert by_id["clear_sky_solar"].start_year == 1984
