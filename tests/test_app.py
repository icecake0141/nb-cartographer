import unittest

from app import (
    CableRow,
    build_device_graph,
    normalize_color,
    parse_cables_csv,
    resolve_data_path,
)


class AppLogicTests(unittest.TestCase):
    def test_normalize_color_accepts_hex_and_lowercases(self):
        self.assertEqual(normalize_color("#ABCDEF", "Cat6"), "#abcdef")

    def test_normalize_color_falls_back_when_invalid(self):
        fallback = normalize_color("blue", "Cat6")
        self.assertRegex(fallback, r"^#[0-9a-f]{6}$")

    def test_parse_cables_csv_extracts_row_and_defaults(self):
        csv_bytes = (
            "Termination A Device,Termination A Name,Termination A Type,"
            "Termination B Device,Termination B Name,Termination B Type,"
            "Type,Color,Rack A,Rack B,Location A,Location B\n"
            "sw1,xe-0/0/1,dcim.interface,srv1,eth0,dcim.interface,Cat6,#ABCDEF,R1,R2,DC1,DC1\n"
        ).encode("utf-8")

        rows, columns = parse_cables_csv(csv_bytes)

        self.assertEqual(len(rows), 1)
        self.assertIsNotNone(columns["a_device"])
        self.assertIsNotNone(columns["b_port"])
        self.assertEqual(rows[0].a_endpoint, "sw1:xe-0/0/1")
        self.assertEqual(rows[0].b_endpoint, "srv1:eth0")
        self.assertEqual(rows[0].cable_type, "Cat6")
        self.assertEqual(rows[0].cable_color, "#abcdef")
        self.assertEqual(rows[0].domain, "data")
        self.assertEqual(rows[0].rack_a, "R1")
        self.assertEqual(rows[0].rack_b, "R2")

    def test_parse_cables_csv_infers_device_from_termination_text(self):
        csv_bytes = (
            "Termination A,Termination B,Type\n" "fw1:ge-0/0/0,sw1:xe-0/0/1,Fiber\n"
        ).encode("utf-8")

        rows, _ = parse_cables_csv(csv_bytes)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].a_device, "fw1")
        self.assertEqual(rows[0].a_interface, "ge-0/0/0")
        self.assertEqual(rows[0].b_device, "sw1")
        self.assertEqual(rows[0].b_interface, "xe-0/0/1")

    def test_build_device_graph_aggregates_links_between_devices(self):
        rows = [
            CableRow(
                a_device="sw1",
                a_interface="xe-0/0/1",
                b_device="srv1",
                b_interface="eth0",
                a_kind="interface",
                b_kind="power_port",
                cable_type="Cat6",
                cable_color="#123456",
                domain="power",
                rack_a="R1",
                rack_b="R2",
                edge_label="Cable-1 [Cat6]",
            ),
            CableRow(
                a_device="sw1",
                a_interface="xe-0/0/2",
                b_device="srv1",
                b_interface="eth1",
                a_kind="interface",
                b_kind="power_port",
                cable_type="Cat6",
                cable_color="#123456",
                domain="power",
                rack_a="R1",
                rack_b="R2",
                edge_label="Cable-2 [Cat6]",
            ),
        ]

        nodes, edges = build_device_graph(rows)

        self.assertEqual(len(nodes), 4)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0]["data"]["count"], 2)
        self.assertEqual(edges[0]["data"]["cable_type"], "Cat6")
        self.assertEqual(edges[0]["data"]["domain"], "power")
        rack_nodes = [n for n in nodes if n["data"]["node_type"] == "rack"]
        device_nodes = [n for n in nodes if n["data"]["node_type"] == "device"]
        self.assertEqual(len(rack_nodes), 2)
        self.assertEqual(len(device_nodes), 2)
        self.assertTrue(all(d["data"].get("parent", "").startswith("rack::") for d in device_nodes))

    def test_parse_cables_csv_does_not_use_termination_name_as_cable_label(self):
        csv_bytes = (
            "Termination A Device,Termination A Name,Termination B Device,Termination B Name,Type\n"
            "sw1,xe-0/0/1,sw2,xe-0/0/2,Cat6\n"
        ).encode("utf-8")

        rows, columns = parse_cables_csv(csv_bytes)

        self.assertEqual(len(rows), 1)
        self.assertIsNone(columns["cable_label"])
        self.assertEqual(rows[0].cable_label, "Cable-1")

    def test_resolve_data_path_rejects_traversal(self):
        with self.assertRaises(ValueError):
            resolve_data_path("../outside.txt")


if __name__ == "__main__":
    unittest.main()
