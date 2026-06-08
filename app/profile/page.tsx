"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';


interface Address {
  id?: string;
  isDefault: boolean;
  country: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  postalCode: string;
  city: string;
  region: string;
  phoneCode: string;
  phone: string;
}

// Asian countries list
const asianCountries = [
  "Afghanistan", "Armenia", "Azerbaijan", "Bahrain", "Bangladesh", "Bhutan", "Brunei", "Cambodia", "China", "Cyprus", "East Timor", "Georgia", "India", "Indonesia", "Iran", "Iraq", "Israel", "Japan", "Jordan", "Kazakhstan", "Kuwait", "Kyrgyzstan", "Laos", "Lebanon", "Malaysia", "Maldives", "Mongolia", "Myanmar (Burma)", "Nepal", "North Korea", "Oman", "Pakistan", "Palestine", "Philippines", "Qatar", "Russia", "Saudi Arabia", "Singapore", "South Korea", "Sri Lanka", "Syria", "Taiwan", "Tajikistan", "Thailand", "Turkey", "Turkmenistan", "United Arab Emirates", "Uzbekistan", "Vietnam", "Yemen"
];

// Asian country codes
const asianCountryCodes: { [key: string]: string } = {
  "Afghanistan": "+93",
  "Armenia": "+374",
  "Azerbaijan": "+994",
  "Bahrain": "+973",
  "Bangladesh": "+880",
  "Bhutan": "+975",
  "Brunei": "+673",
  "Cambodia": "+855",
  "China": "+86",
  "Cyprus": "+357",
  "East Timor": "+670",
  "Georgia": "+995",
  "India": "+91",
  "Indonesia": "+62",
  "Iran": "+98",
  "Iraq": "+964",
  "Israel": "+972",
  "Japan": "+81",
  "Jordan": "+962",
  "Kazakhstan": "+7",
  "Kuwait": "+965",
  "Kyrgyzstan": "+996",
  "Laos": "+856",
  "Lebanon": "+961",
  "Malaysia": "+60",
  "Maldives": "+960",
  "Mongolia": "+976",
  "Myanmar (Burma)": "+95",
  "Nepal": "+977",
  "North Korea": "+850",
  "Oman": "+968",
  "Pakistan": "+92",
  "Palestine": "+970",
  "Philippines": "+63",
  "Qatar": "+974",
  "Russia": "+7",
  "Saudi Arabia": "+966",
  "Singapore": "+65",
  "South Korea": "+82",
  "Sri Lanka": "+94",
  "Syria": "+963",
  "Taiwan": "+886",
  "Tajikistan": "+992",
  "Thailand": "+66",
  "Turkey": "+90",
  "Turkmenistan": "+993",
  "United Arab Emirates": "+971",
  "Uzbekistan": "+998",
  "Vietnam": "+84",
  "Yemen": "+967"
};

// Philippine regions list
const philippineRegions = [
  "Ilocos Region (Region I)",
  "Cagayan Valley (Region II)",
  "Central Luzon (Region III)",
  "CALABARZON (Region IV-A)",
  "MIMAROPA (Region IV-B)",
  "Bicol Region (Region V)",
  "Western Visayas (Region VI)",
  "Central Visayas (Region VII)",
  "Eastern Visayas (Region VIII)",
  "Zamboanga Peninsula (Region IX)",
  "Northern Mindanao (Region X)",
  "Davao Region (Region XI)",
  "SOCCSKSARGEN (Region XII)",
  "Caraga (Region XIII)",
  "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)",
  "Cordillera Administrative Region (CAR)",
  "National Capital Region (NCR)"
];

// Philippine provinces list
const philippineProvinces = [
  "Abra", "Agusan del Norte", "Agusan del Sur", "Aklan", "Albay", "Antique", "Apayao", "Aurora", "Basilan", "Bataan", "Batanes", "Batangas", "Benguet", "Biliran", "Bohol", "Bukidnon", "Bulacan", "Cagayan", "Camarines Norte", "Camarines Sur", "Camiguin", "Capiz", "Catanduanes", "Cavite", "Cebu", "Cotabato", "Davao de Oro", "Davao del Norte", "Davao del Sur", "Davao Occidental", "Davao Oriental", "Dinagat Islands", "Eastern Samar", "Guimaras", "Ifugao", "Ilocos Norte", "Ilocos Sur", "Iloilo", "Isabela", "Kalinga", "La Union", "Laguna", "Lanao del Norte", "Lanao del Sur", "Leyte", "Maguindanao del Norte", "Maguindanao del Sur", "Marinduque", "Masbate", "Metro Manila", "Misamis Occidental", "Misamis Oriental", "Mountain Province", "Negros Occidental", "Negros Oriental", "Northern Samar", "Nueva Ecija", "Nueva Vizcaya", "Occidental Mindoro", "Oriental Mindoro", "Palawan", "Pampanga", "Pangasinan", "Quezon", "Quirino", "Rizal", "Romblon", "Samar", "Sarangani", "Siquijor", "Sorsogon", "South Cotabato", "Southern Leyte", "Sultan Kudarat", "Sulu", "Surigao del Norte", "Surigao del Sur", "Tarlac", "Tawi-Tawi", "Zambales", "Zamboanga del Norte", "Zamboanga del Sur", "Zamboanga Sibugay"
];

type AddressRow = {
  id: string;
  is_default: boolean;
  country: string;
  first_name: string;
  last_name: string;
  address1: string;
  address2: string | null;
  postal_code: string;
  city: string;
  region: string;
  phone: string;
};

function mapRowToAddress(row: AddressRow): Address {
  return {
    id: row.id,
    isDefault: row.is_default,
    country: row.country,
    firstName: row.first_name,
    lastName: row.last_name,
    address1: row.address1,
    address2: row.address2 ?? undefined,
    postalCode: row.postal_code,
    city: row.city,
    region: row.region,
    phoneCode: "",
    phone: row.phone,
  };
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isAddingAddress, setIsAddingAddress] = useState(false); // New state for address modal
  const [addresses, setAddresses] = useState<Address[]>([]); // State to store addresses

  // State for Add Address Form
  const [newAddress, setNewAddress] = useState<Address>({
    isDefault: false,
    country: "Philippines",
    firstName: "",
    lastName: "",
    address1: "",
    address2: "",
    postalCode: "",
    city: "",
    region: "Abra",
    phoneCode: "+63",
    phone: "",
  });

  // Email is read-only in profile; change via Supabase Auth dashboard or a future settings flow.
  const userEmail = user?.email || "N/A";

  const handleEditClick = () => {
    setIsEditing(true);
    // Populate with existing data if available (e.g., from user object or a database fetch)
    if (user?.displayName) {
      const nameParts = user.displayName.split(' ');
      setFirstName(nameParts[0] || "");
      setLastName(nameParts.slice(1).join(' ') || "");
    } else {
      setFirstName("");
      setLastName("");
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      const displayName = `${firstName} ${lastName}`.trim();

      const { error: authError } = await supabase.auth.updateUser({
        data: { displayName },
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.uid,
        email: user.email ?? "",
        display_name: displayName,
      });
      if (profileError) throw profileError;

      await supabase
        .from("users")
        .update({ display_name: displayName })
        .eq("id", user.uid);

      await refreshUser();
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleAddAddressClick = () => {
    setIsAddingAddress(true);
  };

  const handleAddressModalClose = () => {
    setIsAddingAddress(false);
    setNewAddress({
      isDefault: false,
      country: "Philippines",
      firstName: "",
      lastName: "",
      address1: "",
      address2: "",
      postalCode: "",
      city: "",
      region: "Abra",
      phoneCode: "+63",
      phone: "",
    }); // Clear form on close
  };

  const handleAddressSave = async () => {
    // Validation: check only required fields (address2 is optional)
    if (
      !newAddress.firstName.trim() ||
      !newAddress.lastName.trim() ||
      !newAddress.address1.trim() ||
      !newAddress.postalCode.trim() ||
      !newAddress.city.trim() ||
      !newAddress.region.trim() ||
      !newAddress.country.trim() ||
      !newAddress.phoneCode.trim() ||
      !newAddress.phone.trim()
    ) {
      alert("Please fill out all the fields.");
      return;
    }

    // Additional validation for +63 phone numbers
    if (newAddress.country === 'Philippines') {
      if (!/^09\d{9}$/.test(newAddress.phone)) {
        alert('For Philippine numbers, the phone number must start with 09 and be exactly 11 digits.');
        return;
      }
    }

    if (!user) {
      alert("You must be logged in to save an address.");
      return;
    }

    try {
      const phone =
        newAddress.phoneCode === "+63"
          ? `+63${newAddress.phone.replace(/^0/, "")}`
          : `${newAddress.phoneCode}${newAddress.phone}`;

      if (newAddress.isDefault) {
        await supabase
          .from("addresses")
          .update({ is_default: false })
          .eq("user_id", user.uid);
      }

      const { error } = await supabase.from("addresses").insert({
        user_id: user.uid,
        is_default: newAddress.isDefault,
        country: newAddress.country,
        first_name: newAddress.firstName,
        last_name: newAddress.lastName,
        address1: newAddress.address1,
        address2: newAddress.address2 || null,
        postal_code: newAddress.postalCode,
        city: newAddress.city,
        region: newAddress.region,
        phone,
      });
      if (error) throw error;

      handleAddressModalClose();
      await fetchAddresses();
    } catch (error) {
      console.error("Error saving address:", error);
      alert("Failed to save address. Please try again.");
    }
  };

  const fetchAddresses = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.uid)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAddresses((data as AddressRow[]).map(mapRowToAddress));
    } catch (error) {
      console.error("Error fetching addresses:", error);
    }
  };

  // Fetch addresses on component mount or when user changes
  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user]);

  // Set selected address as default and unset others
  const handleSetDefaultAddress = async (addressId: string) => {
    if (!user) return;
    try {
      const { error: clearError } = await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", user.uid);
      if (clearError) throw clearError;

      const { error: setError } = await supabase
        .from("addresses")
        .update({ is_default: true })
        .eq("id", addressId)
        .eq("user_id", user.uid);
      if (setError) throw setError;

      await fetchAddresses();
    } catch (error) {
      alert("Failed to set default address.");
      console.error(error);
    }
  };

  const handleRemoveAddress = async (addressId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("addresses")
        .delete()
        .eq("id", addressId)
        .eq("user_id", user.uid);
      if (error) throw error;
      await fetchAddresses();
    } catch (error) {
      alert("Failed to remove address.");
      console.error(error);
    }
  };

  // When country changes, update phoneCode automatically
  useEffect(() => {
    if (newAddress.country && asianCountryCodes[newAddress.country]) {
      setNewAddress(addr => ({ ...addr, phoneCode: asianCountryCodes[newAddress.country] }));
    }
    // eslint-disable-next-line
  }, [newAddress.country]);

  return (
    <div className="min-h-screen bg-[#101828] text-[#60A5FA]">
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-8">
        <div className="bg-[#19223a] rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-extrabold mb-8 text-[#60A5FA]">Profile</h1>
          <div className="bg-[#101828] rounded-xl p-6 mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#60A5FA] mb-1">{user?.displayName ? user.displayName : 'Your Name'}</h2>
              <p className="text-[#60A5FA]">Email: {userEmail}</p>
            </div>
            <button className="flex items-center gap-2 text-[#60A5FA] border border-[#60A5FA] px-4 py-2 rounded-lg font-semibold hover:bg-[#60A5FA] hover:text-[#101828] transition-colors" onClick={handleEditClick}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.25 2.25 0 1 1 3.182 3.183L7.5 20.213l-4.243 1.06 1.06-4.243 12.545-12.543z" />
              </svg>
              Edit
            </button>
          </div>
          <div className="bg-[#101828] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#60A5FA]">Addresses</h2>
              <button className="flex items-center gap-2 text-[#60A5FA] border border-[#60A5FA] px-4 py-2 rounded-lg font-semibold hover:bg-[#60A5FA] hover:text-[#101828] transition-colors" onClick={handleAddAddressClick}>
                <span className="text-lg font-bold">+</span> Add
              </button>
            </div>
            {addresses.length === 0 ? (
              <p className="text-[#60A5FA]">No addresses added</p>
            ) : (
              <div className="space-y-4">
                {[...addresses].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)).map((addr) => (
                  <div key={addr.id} className="border p-4 rounded-md">
                    <p className="font-semibold">{addr.firstName} {addr.lastName}</p>
                    <p>{addr.address1}</p>
                    {addr.address2 && <p>{addr.address2}</p>}
                    <p>{addr.city}, {addr.postalCode}</p>
                    <p>{addr.region}, {addr.country}</p>
                    <p>Phone: {addr.phone}</p>
                    {addr.isDefault && <span className="text-xs text-blue-600">Default Address</span>}
                    <div className="flex items-center space-x-4 mt-2">
                      {!addr.isDefault && (
                        <button
                          className="text-xs text-blue-600 underline hover:text-blue-800"
                          onClick={() => handleSetDefaultAddress(addr.id!)}
                        >
                          Set as Default
                        </button>
                      )}
                      <button
                        className="text-xs text-red-600 underline hover:text-red-800"
                        onClick={() => handleRemoveAddress(addr.id!)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-[#19223a] p-8 rounded-xl shadow-lg w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-[#60A5FA]">Edit Profile</h2>
            <div className="mb-4">
              <label className="block mb-1 text-[#60A5FA]">First Name</label>
              <input
                className="w-full px-3 py-2 rounded border border-[#60A5FA] bg-[#101828] text-[#60A5FA]"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-[#60A5FA]">Last Name</label>
              <input
                className="w-full px-3 py-2 rounded border border-[#60A5FA] bg-[#101828] text-[#60A5FA]"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded bg-[#60A5FA] text-[#101828] font-semibold" onClick={handleSave}>Save</button>
              <button className="px-4 py-2 rounded bg-[#101828] text-[#60A5FA] border border-[#60A5FA] font-semibold" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Add Address Modal */}
      {isAddingAddress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-[#19223a] p-8 rounded-xl shadow-lg w-full max-w-2xl text-[#60A5FA] border border-[#222f43]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-[#60A5FA]">Add address</h2>
              <button className="text-2xl font-bold text-[#60A5FA] hover:text-[#3390ff]" onClick={handleAddressModalClose}>&times;</button>
            </div>
            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                id="isDefault"
                checked={newAddress.isDefault}
                onChange={e => setNewAddress({ ...newAddress, isDefault: e.target.checked })}
                className="mr-2 accent-[#60A5FA]"
              />
              <label htmlFor="isDefault" className="text-[#60A5FA]">This is my default address</label>
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-[#60A5FA] font-semibold">Country/region</label>
              <Select value={newAddress.country} onValueChange={value => setNewAddress({ ...newAddress, country: value, region: "" })}>
                <SelectTrigger className="w-full bg-[#101828] border border-[#60A5FA] text-[#60A5FA]">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {asianCountries.map(country => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-1 text-[#60A5FA] font-semibold">First name</label>
                <input
                  className="w-full px-3 py-2 rounded border border-[#60A5FA] bg-[#101828] text-[#60A5FA]"
                  value={newAddress.firstName}
                  onChange={e => setNewAddress({ ...newAddress, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="block mb-1 text-[#60A5FA] font-semibold">Last name</label>
                <input
                  className="w-full px-3 py-2 rounded border border-[#60A5FA] bg-[#101828] text-[#60A5FA]"
                  value={newAddress.lastName}
                  onChange={e => setNewAddress({ ...newAddress, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-[#60A5FA] font-semibold">Address</label>
              <input
                className="w-full px-3 py-2 rounded border border-[#60A5FA] bg-[#101828] text-[#60A5FA]"
                value={newAddress.address1}
                onChange={e => setNewAddress({ ...newAddress, address1: e.target.value })}
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-[#60A5FA] font-semibold">Apartment, suite, etc. (optional)</label>
              <input
                className="w-full px-3 py-2 rounded border border-[#60A5FA] bg-[#101828] text-[#60A5FA]"
                value={newAddress.address2}
                onChange={e => setNewAddress({ ...newAddress, address2: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-1 text-[#60A5FA] font-semibold">Postal code</label>
                <input
                  className="w-full px-3 py-2 rounded border border-[#60A5FA] bg-[#101828] text-[#60A5FA]"
                  value={newAddress.postalCode}
                  onChange={e => setNewAddress({ ...newAddress, postalCode: e.target.value })}
                />
              </div>
              <div>
                <label className="block mb-1 text-[#60A5FA] font-semibold">City</label>
                <input
                  className="w-full px-3 py-2 rounded border border-[#60A5FA] bg-[#101828] text-[#60A5FA]"
                  value={newAddress.city}
                  onChange={e => setNewAddress({ ...newAddress, city: e.target.value })}
                />
              </div>
            </div>
            {/* Region/Province Dropdown: Only show if country is Philippines */}
            {newAddress.country === 'Philippines' && (
              <div className="mb-6">
                <label className="block mb-1 text-[#60A5FA] font-semibold">Region</label>
                <Select value={newAddress.region} onValueChange={value => setNewAddress({ ...newAddress, region: value })}>
                  <SelectTrigger className="w-full bg-[#101828] border border-[#60A5FA] text-[#60A5FA]">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    {philippineProvinces.map(province => (
                      <SelectItem key={province} value={province}>{province}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Phone Number Row */}
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="sm:col-span-1">
                <label className="block mb-1 text-[#60A5FA] font-semibold">Country code</label>
                <Select
                  value={newAddress.phoneCode}
                  onValueChange={value => setNewAddress({ ...newAddress, phoneCode: value })}
                >
                  <SelectTrigger className="w-full bg-[#101828] border border-[#60A5FA] text-[#60A5FA]">
                    <SelectValue placeholder="Code" />
                  </SelectTrigger>
                  <SelectContent>
                    {asianCountries.map(country => (
                      <SelectItem key={country} value={asianCountryCodes[country] || ""}>
                        {country} ({asianCountryCodes[country] || ""})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="block mb-1 text-[#60A5FA] font-semibold">Phone number</label>
                <input
                  className="w-full px-3 py-2 rounded border border-[#60A5FA] bg-[#101828] text-[#60A5FA]"
                  value={newAddress.phone}
                  onChange={e => {
                    let val = e.target.value.replace(/[^0-9]/g, '');
                    if (newAddress.country === 'Philippines') {
                      if (val.length > 11) val = val.slice(0, 11);
                    }
                    setNewAddress({ ...newAddress, phone: val });
                  }}
                  placeholder="Enter phone number"
                  maxLength={newAddress.country === 'Philippines' ? 11 : undefined}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded bg-[#222f43] text-[#60A5FA] font-semibold border border-[#60A5FA] hover:bg-[#101828]" onClick={handleAddressModalClose}>Cancel</button>
              <button className="px-4 py-2 rounded bg-[#60A5FA] text-[#101828] font-semibold hover:bg-[#3390ff]" onClick={handleAddressSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 